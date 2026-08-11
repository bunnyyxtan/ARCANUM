import asyncio
import sys
import os
sys.path.insert(0, os.path.abspath('src'))
from unittest.mock import AsyncMock
from client import AsyncArcanumClient

async def main():
    client = AsyncArcanumClient("0x0000000000000000000000000000000000000000", AsyncMock(), {"id": 1}, "http://localhost:8545")
    client.wallet.functions.escalationManager = AsyncMock()
    mock_manager = AsyncMock()
    mock_status_call = AsyncMock()
    mock_status_call.call = AsyncMock(return_value=1) # EXECUTED
    mock_manager.functions.statusOf = AsyncMock(return_value=mock_status_call)
    client.web3.eth.contract = AsyncMock(return_value=mock_manager)
    callback = AsyncMock()
    
    try:
        # Override asyncio.sleep to not actually sleep but yield
        real_sleep = asyncio.sleep
        async def fast_sleep(t):
            await real_sleep(0.01)
        asyncio.sleep = fast_sleep
        
        await asyncio.wait_for(client.on_escalation_resolved("0x123", callback), timeout=0.1)
    except asyncio.TimeoutError:
        print("TimeoutError: on_escalation_resolved blocked forever despite terminal status.")
        assert callback.called

asyncio.run(main())
