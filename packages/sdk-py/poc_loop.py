import asyncio
from unittest.mock import AsyncMock, MagicMock
import sys
import os
sys.path.insert(0, os.path.abspath('src'))
from arcanum_sdk.client import AsyncArcanumClient

async def run_poc():
    signer = MagicMock()
    signer.address = "0x1111111111111111111111111111111111111111"
    client = AsyncArcanumClient("0x0000000000000000000000000000000000000000", signer, {"id": 1}, "http://localhost:8545")
    
    # Mocking EscalationManager address and statusOf
    client.wallet.functions.escalationManager = AsyncMock()
    mock_manager = AsyncMock()
    mock_status_call = AsyncMock()
    # Return 1 for "EXECUTED" which is a terminal state
    mock_status_call.call = AsyncMock(return_value=1)
    mock_manager.functions.statusOf = AsyncMock(return_value=mock_status_call)
    
    client.web3.eth.contract = MagicMock(return_value=mock_manager)

    callback = AsyncMock()

    try:
        real_sleep = asyncio.sleep
        async def fast_sleep(t):
            await real_sleep(0.01)
        asyncio.sleep = fast_sleep
        
        await asyncio.wait_for(client.on_escalation_resolved("0x123", callback), timeout=0.1)
    except asyncio.TimeoutError:
        print("Infinite loop detected: on_escalation_resolved blocked forever despite terminal status.")

asyncio.run(run_poc())
