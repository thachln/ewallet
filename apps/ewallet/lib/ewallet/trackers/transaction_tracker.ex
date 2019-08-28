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

defmodule EWallet.TransactionTracker do
  @moduledoc """
  This module is a GenServer started dynamically for a specific eWallet transaction
  It will registers itself with the blockchain adapter to receive events about
  a given transactions and act on it
  """
  use GenServer, restart: :temporary
  require Logger

  alias EWallet.{BlockchainHelper, BlockchainTransactionState}
  alias ActivityLogger.System

  @backup_confirmations_threshold 10

  # TODO: handle failed transactions

  def start_link(attrs) do
    GenServer.start_link(__MODULE__, attrs)
  end

  def init(%{transaction: transaction} = attrs) do
    adapter = BlockchainHelper.adapter()
    :ok = adapter.subscribe(:transaction, transaction.blockchain_tx_hash, self())

    {:ok,
     %{
       transaction: transaction,
       # optional
       registry: attrs[:registry]
     }}
  end

  def handle_cast(
        {:confirmations_count, tx_hash, confirmations_count},
        %{transaction: transaction} = state
      ) do
    case transaction.blockchain_tx_hash == tx_hash do
      true ->
        adapter = BlockchainHelper.adapter()
        threshold = Application.get_env(:ewallet, :blockchain_confirmations_threshold)

        if is_nil(threshold) do
          Logger.warn("Blockchain Confirmations Threshold not set in configuration: using 10.")
        end

        update_confirmations_count(
          adapter,
          state,
          confirmations_count,
          confirmations_count >= (threshold || @backup_confirmations_threshold)
        )

      false ->
        {:noreply, state}
    end
  end

  # Treshold reached, finalizing the transaction...
  defp update_confirmations_count(
         adapter,
         %{transaction: transaction} = state,
         confirmations_count,
         true
       ) do
    {:ok, transaction} =
      BlockchainTransactionState.transition_to(
        :confirmed,
        transaction,
        confirmations_count,
        %System{}
      )

    # Unsubscribing from the blockchain subapp
    :ok = adapter.unsubscribe(:transaction, transaction.blockchain_tx_hash, self())

    case is_nil(state[:registry]) do
      true ->
        {:stop, :normal, Map.put(state, :transaction, transaction)}

      false ->
        :ok = GenServer.cast(state[:registry], {:stop_tracker, transaction.uuid})
        {:noreply, Map.put(state, :transaction, transaction)}
    end
  end

  # Treshold not reached yet, updating and continuing to track...
  defp update_confirmations_count(
         _adapter,
         %{transaction: transaction} = state,
         confirmations_count,
         false
       ) do
    {:ok, transaction} =
      BlockchainTransactionState.transition_to(
        :pending_confirmations,
        transaction,
        confirmations_count,
        %System{}
      )

    {:noreply, Map.put(state, :transaction, transaction)}
  end
end