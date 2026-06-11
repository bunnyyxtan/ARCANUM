test:
	FOUNDRY_PROFILE=ci forge test -vvv

invariants:
	FOUNDRY_PROFILE=ci forge test --match-contract Invariants -vvv

coverage:
	forge coverage --report summary --report lcov --no-match-coverage "(script|test|src/mocks)"
