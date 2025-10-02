// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ITokenReceiver {
    function onTokenTransfer(address from, uint256 amount, bytes calldata data) external returns (bool);
}

interface IAbrahamTokenLite {
    function transfer(address to, uint256 amount) external returns (bool);
}

/**
 * Simple staking vault (global per-user stake).
 * - Users stake by token.transferAndCall(this, amount, data) — data ignored.
 * - Users unstake(amount) to withdraw.
 * - No per-creation logic here.
 */
contract AbrahamStaking is ITokenReceiver {
    IAbrahamTokenLite public immutable token;

    mapping(address => uint256) private _staked;

    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);

    constructor(address token_) {
        require(token_ != address(0), "token=0");
        token = IAbrahamTokenLite(token_);
    }

    function onTokenTransfer(address from, uint256 amount, bytes calldata) external override returns (bool) {
        require(msg.sender == address(token), "only token");
        require(amount > 0, "amount=0");
        _staked[from] += amount;
        emit Staked(from, amount);
        return true;
    }

    function unstake(uint256 amount) external {
        require(amount > 0, "amount=0");
        uint256 cur = _staked[msg.sender];
        require(cur >= amount, "insufficient");
        unchecked { _staked[msg.sender] = cur - amount; }
        require(token.transfer(msg.sender, amount), "transfer failed");
        emit Unstaked(msg.sender, amount);
    }

    function stakedBalance(address user) external view returns (uint256) {
        return _staked[user];
    }
}
