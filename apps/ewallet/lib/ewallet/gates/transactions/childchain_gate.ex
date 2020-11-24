# Copyright 2018-2019 OmiseGO Pte Ltd
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

defmodule EWallet.TransactionGate.Childchain do
  @moduledoc """
  This is an intermediary module that formats the params so they can be processed by
  the TransactionGate.Blockchain
  """
  alias EWallet.{TokenFetcher, TransactionGate, BlockchainHelper}
  alias EWalletDB.Transaction

  @eth BlockchainHelper.adapter().helper().default_token().address

  def deposit(actor, %{"amount" => amount} = attrs)
      when is_integer(amount) or is_binary(amount) do
    case build_transaction_attrs(attrs) do
      {:ok, attrs} ->
        validation_tuple = address_validation_tuple(attrs)
        TransactionGate.Blockchain.create(actor, attrs, validation_tuple)

      error ->
        error
    end
  end

  def deposit(_, _) do
    {:error, :invalid_parameter, "Invalid parameter provided. `amount` is required."}
  end

  defp build_transaction_attrs(%{"address" => address} = attrs) do
    case get_vault_address(attrs) do
      {:ok, contract_address} ->
        {:ok,
         attrs
         |> Map.put("from_address", address)
         |> Map.put("to_address", contract_address)
         |> Map.delete("address")
         |> Map.put("type", Transaction.deposit())
         |> Map.put("rootchain_identifier", BlockchainHelper.rootchain_identifier())
         |> Map.put("childchain_identifier", BlockchainHelper.childchain_identifier())}

      error ->
        error
    end
  end

  defp get_vault_address(attrs) do
    with {:ok, token} <- TokenFetcher.fetch(attrs),
         :ok <- TransactionGate.Blockchain.validate_blockchain_token(token) do
      vault_address_for_token(token)
    else
      error -> error
    end
  end

  defp vault_address_for_token(%{blockchain_address: @eth}) do
    BlockchainHelper.call(:get_childchain_eth_vault_address)
  end

  defp vault_address_for_token(_) do
    BlockchainHelper.call(:get_childchain_erc20_vault_address)
  end

  defp address_validation_tuple(attrs) do
    {
      BlockchainHelper.validate_blockchain_address(attrs["from_address"]) == :ok,
      BlockchainHelper.validate_blockchain_address(attrs["to_address"]) == :ok
    }
  end
end
