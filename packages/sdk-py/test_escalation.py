import threading
from unittest.mock import Mock, MagicMock

from arcanum_sdk.client import ArcanumClient

class MockContractFunction:
    def call(self):
        return "0x1234"

class MockContract:
    def __init__(self, *args, **kwargs):
        self.functions = MagicMock()
        self.functions.escalationManager.return_value.call.return_value = "0x1234"
        self.functions.statusOf.return_value.call.return_value = 0

class MockWeb3Eth:
    def contract(self, *args, **kwargs):
        return MockContract()

class MockWeb3:
    def __init__(self, *args, **kwargs):
        self.eth = MockWeb3Eth()

def to_checksum_address(addr):
    return addr
MockWeb3.to_checksum_address = to_checksum_address

import arcanum_sdk.client
arcanum_sdk.client.Web3 = MockWeb3

client = ArcanumClient("0x00", Mock(), {}, "http://rpc")
client.web3 = MockWeb3()
client.wallet = MockContract()

def test():
    print("calling on_escalation_resolved")
    stop = client.on_escalation_resolved("esc1", lambda x: print(x))
    print("returned!")

t = threading.Thread(target=test)
t.start()
t.join(2.0)
if t.is_alive():
    print("Thread blocked!")
else:
    print("Thread did not block")

