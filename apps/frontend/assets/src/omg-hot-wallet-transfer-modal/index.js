import React, { Component } from 'react'
import PropTypes from 'prop-types'
import styled from 'styled-components'
import { connect } from 'react-redux'
import { compose } from 'recompose'
import { withRouter } from 'react-router-dom'

import { Button, Icon, SelectInput } from '../omg-uikit'
import Modal from '../omg-modal'
import { transfer } from '../omg-transaction/action'
import { getWalletById } from '../omg-wallet/action'
import { formatAmount } from '../utils/formatter'
import { AllBlockchainWalletsFetcher } from '../omg-blockchain-wallet/blockchainwalletsFetcher'
import BlockchainWalletSelect from '../omg-blockchain-wallet-select'
import { selectBlockchainWalletBalance } from '../omg-blockchain-wallet/selector'
import TokenSelect from '../omg-token-select'

const Form = styled.form`
  width: 100vw;
  height: 100vh;
  position: relative;
  > i {
    position: absolute;
    right: 30px;
    top: 30px;
    color: ${props => props.theme.colors.S400};
    cursor: pointer;
    font-size: 30px;
  }
  input {
    margin-top: 5px;
  }
  button {
    margin: 35px 0 0;
    font-size: 14px;
  }
  h4 {
    text-align: center;
    margin-bottom: 40px;
    font-size: 18px;
  }
`
const ButtonContainer = styled.div`
  text-align: center;
`
const Error = styled.div`
  color: ${props => props.theme.colors.R400};
  text-align: center;
  padding: 10px 0;
  overflow: hidden;
  max-height: ${props => (props.error ? '100px' : 0)};
  opacity: ${props => (props.error ? 1 : 0)};
  transition: 0.5s ease max-height, 0.3s ease opacity;
`
const FromToContainer = styled.div`
  h5 {
    letter-spacing: 1px;
    background-color: ${props => props.theme.colors.S300};
    display: inline-block;
    padding: 5px 10px;
    border-radius: 2px;
  }
  i[name='Wallet'] {
    color: ${props => props.theme.colors.B100};
    padding: 8px;
    border-radius: 6px;
    border: 1px solid ${props => props.theme.colors.S400};
    margin-right: 10px;
  }
`
const InnerTransferContainer = styled.div`
  max-width: 600px;
  padding: 50px;
  margin: 0 auto;
`
const StyledSelectInput = styled(SelectInput)`
  margin-top: 10px;
  margin-bottom: 20px;
`
const enhance = compose(
  withRouter,
  connect(
    state => ({ selectBlockchainWalletBalance: selectBlockchainWalletBalance(state) }),
    { transfer, getWalletById }
  )
)
class CreateTransaction extends Component {
  static propTypes = {
    onRequestClose: PropTypes.func,
    fromAddress: PropTypes.string,
    selectBlockchainWalletBalance: PropTypes.func,
    getWalletById: PropTypes.func,
    onCreateTransaction: PropTypes.func,
    transfer: PropTypes.func
  }
  static defaultProps = {
    onCreateTransaction: _.noop
  }
  state = {
    fromTokenAmount: '',
    fromTokenSearchToken: '',
    fromAddress: this.props.fromAddress || '',
    toAddress: ''
  }
  onChangeAmount = type => e => {
    this.setState({ [`${type}Amount`]: e.target.value })
  }
  onSelectTokenSelect = type => token => {
    this.setState({
      [`${type}SearchToken`]: _.get(token, 'token.name'),
      [`${type}Selected`]: token
    })
  }
  onSelectToAddressSelect = item => {
    if (item) {
      this.setState({
        toAddress: item.key,
        toAddressSelect: true,
        toTokenSelected: this.state.toTokenSelected
          ? item.balances.find(b => b.token.id === _.get(this.state.toTokenSelected, 'token.id'))
          : null
      })
    } else {
      this.setState({
        toAddress: '',
        toAddressSelect: false,
        toTokenSelected: null,
        toTokenSearchToken: ''
      })
    }
  }
  onSubmit = async e => {
    e.preventDefault()
    this.setState({ submitting: true })
    try {
      const fromAmount = formatAmount(
        this.state.fromTokenAmount,
        _.get(this.state.fromTokenSelected, 'token.subunit_to_unit')
      )
      const result = await this.props.transfer({
        fromAddress: this.state.fromAddress.trim(),
        toAddress: this.state.toAddress.trim(),
        fromTokenId: _.get(this.state.fromTokenSelected, 'token.id'),
        toTokenId:
          _.get(this.state.toTokenSelected, 'token.id') ||
          _.get(this.state.fromTokenSelected, 'token.id'),
        amount: fromAmount
      })
      if (result.data) {
        this.props.getWalletById(this.state.fromAddress)
        this.props.getWalletById(this.state.toAddress)
        this.onRequestClose()
      } else {
        this.setState({
          submitting: false,
          error: result.error.description || result.error.message
        })
      }
      this.props.onCreateTransaction()
    } catch (e) {
      this.setState({ error: JSON.stringify(e.message) })
    }
  }
  onRequestClose = () => {
    this.props.onRequestClose()
    this.setState({ submitting: false })
  }

  renderFromSection () {
    const walletBalance = this.props.selectBlockchainWalletBalance(this.state.fromAddress)
    return (
      <FromToContainer>
        <h5>From</h5>
        <StyledSelectInput
          selectProps={{
            label: 'Wallet Address',
            disabled: !!this.props.fromAddress,
            value: this.state.fromAddress,
            valueRenderer: value => (
              <BlockchainWalletSelect
                icon='Wallet'
                topRow={value}
                bottomRow='Hot wallet'
              />
            ),
            prefix: <Icon name='Wallet' />
          }}
        />
        <StyledSelectInput
          inputProps={{
            label: 'Amount to send',
            value: this.state.fromTokenAmount,
            onChange: this.onChangeAmount('fromToken'),
            type: 'amount',
            maxAmountLength: 18,
            suffix: _.get(this.state.fromTokenSelected, 'token.symbol')
          }}
          selectProps={{
            label: 'Token',
            clearable: true,
            onSelectItem: this.onSelectTokenSelect('fromToken'),
            value: this.state.fromTokenSearchToken,
            filterByKey: true,
            valueRenderer: this.state.fromTokenSelected
              ? value => {
                const found = _.find(
                  walletBalance,
                  b => b.token.name.toLowerCase() === value.toLowerCase()
                )
                return found
                  ? <TokenSelect balance={found.amount} token={found.token} />
                  : value
              }
              : null,
            options:
              walletBalance.length
                ? walletBalance.map(b => ({
                  key: `${b.token.name}${b.token.symbol}${b.token.id}`,
                  value: <TokenSelect balance={b.amount} token={b.token} />,
                  ...b
                }))
                : []
          }}
        />
      </FromToContainer>
    )
  }
  renderToSection () {
    return (
      <FromToContainer>
        <h5 style={{ marginTop: '20px' }}>To</h5>
        <AllBlockchainWalletsFetcher
          render={({ blockchainWallets }) => {
            return (
              <StyledSelectInput
                selectProps={{
                  label: 'Wallet Address',
                  clearable: true,
                  onSelectItem: this.onSelectToAddressSelect,
                  value: this.state.toAddress,
                  onChange: this.onChangeInputToAddress,
                  valueRenderer: this.state.toAddressSelect
                    ? value => {
                      const wallet = _.find(blockchainWallets, i => i.address === value)
                      return wallet
                        ? (
                          <BlockchainWalletSelect
                            icon='Wallet'
                            topRow={wallet.address}
                            bottomRow={`${wallet.name} | ${wallet.type}`}
                          />
                        )
                        : value
                    }
                    : null,
                  options:
                    blockchainWallets
                      ? blockchainWallets.filter(i => i.type === 'cold')
                        .map(d => {
                          return {
                            key: d.address,
                            value: (
                              <BlockchainWalletSelect
                                icon='Wallet'
                                topRow={d.address}
                                bottomRow={`${d.name} | ${d.type}`}
                              />
                            ),
                            ...d
                          }
                        })
                      : []
                }}
              />
            )
          }}
        />
      </FromToContainer>
    )
  }
  render () {
    return (
      <Form onSubmit={this.onSubmit} noValidate>
        <Icon name='Close' onClick={this.props.onRequestClose} />
        <InnerTransferContainer>
          <h4>Transfer</h4>
          {this.renderFromSection()}
          {this.renderToSection()}
          <ButtonContainer>
            <Button
              size='small'
              type='submit'
              disabled={
                !this.state.fromAddress ||
                !this.state.toAddress ||
                !this.state.fromTokenSearchToken ||
                !this.state.fromTokenAmount
              }
              loading={this.state.submitting}
            >
              <span>Transfer</span>
            </Button>
          </ButtonContainer>
          <Error error={this.state.error}>{this.state.error}</Error>
        </InnerTransferContainer>
      </Form>
    )
  }
}
const EnhancedCreateTransaction = enhance(CreateTransaction)
export default class HotWalletTransferModal extends Component {
  static propTypes = {
    open: PropTypes.bool,
    onRequestClose: PropTypes.func,
    onCreateTransaction: PropTypes.func,
    fromAddress: PropTypes.string
  }
  render = () => {
    return (
      <Modal
        isOpen={this.props.open}
        onRequestClose={this.props.onRequestClose}
        contentLabel='create transaction modal'
        overlayClassName='create-transaction-modal'
      >
        <EnhancedCreateTransaction
          onRequestClose={this.props.onRequestClose}
          onCreateTransaction={this.props.onCreateTransaction}
          fromAddress={this.props.fromAddress}
        />
      </Modal>
    )
  }
}