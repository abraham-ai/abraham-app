// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ERC-677-like TokenReceiver interface
 * @dev Contracts that want to react to token transfers should implement this.
 */
interface ITokenReceiver {
    function onTokenTransfer(address from, uint256 amount, bytes calldata data) external returns (bool);
}

/**
 * @title Abraham Token (test token)
 * @notice Minimal ERC20 with ERC-677-like transferAndCall for staking without approvals.
 *         - Standard ERC20: transfer / approve / transferFrom
 *         - Extended: transferAndCall(to, amount, data) -> transfer + call onTokenTransfer on 'to'
 */
contract AbrahamToken {
    /* ERC20 meta */
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;

    /* ERC20 storage */
    uint256 public totalSupply;
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    /* events */
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor() {
        name = "Abraham Token";
        symbol = "ABRAHAM";
        _mint(msg.sender, 1_000_000 * 10**decimals); // 1M for tests
    }

    /* --------------------- ERC20 core --------------------- */
    function balanceOf(address account) external view returns (uint256) {
        return _balances[account];
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function allowance(address owner, address spender) external view returns (uint256) {
        return _allowances[owner][spender];
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 current = _allowances[from][msg.sender];
        require(current >= amount, "ERC20: insufficient allowance");
        unchecked {
            _approve(from, msg.sender, current - amount);
        }
        _transfer(from, to, amount);
        return true;
    }

    /* --------- ERC-677-like: transfer and call ------------ */
    function transferAndCall(address to, uint256 amount, bytes calldata data) external returns (bool) {
        _transfer(msg.sender, to, amount);
        if (_isContract(to)) {
            bool ok = ITokenReceiver(to).onTokenTransfer(msg.sender, amount, data);
            require(ok, "onTokenTransfer failed");
        }
        return true;
    }

    /* --------------------- internals ---------------------- */
    function _transfer(address from, address to, uint256 amount) internal {
        require(to != address(0), "ERC20: to=0");
        uint256 bal = _balances[from];
        require(bal >= amount, "ERC20: insufficient balance");
        unchecked {
            _balances[from] = bal - amount;
        }
        _balances[to] += amount;
        emit Transfer(from, to, amount);
    }

    function _approve(address owner, address spender, uint256 amount) internal {
        require(spender != address(0), "ERC20: spender=0");
        require(owner != address(0), "ERC20: owner=0");
        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    function _mint(address to, uint256 amount) internal {
        require(to != address(0), "ERC20: to=0");
        totalSupply += amount;
        _balances[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function _isContract(address a) private view returns (bool) {
        return a.code.length > 0;
    }
}
