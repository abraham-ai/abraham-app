// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * Receiver interface for ERC-677-like transferAndCall.
 */
interface ITokenReceiver {
    function onTokenTransfer(address from, uint256 amount, bytes calldata data) external returns (bool);
}

/**
 * Minimal ERC20 with transferAndCall.
 */
contract AbrahamToken {
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;

    uint256 public totalSupply;
    mapping(address => uint256) private _bal;
    mapping(address => mapping(address => uint256)) private _allow;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor() {
        name = "Abraham Token";
        symbol = "ABRAHAM";
        _mint(msg.sender, 1_000_000 * 10**decimals);
    }

    /* ERC20 basic */
    function balanceOf(address a) external view returns (uint256) { return _bal[a]; }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function allowance(address owner, address spender) external view returns (uint256) {
        return _allow[owner][spender];
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 cur = _allow[from][msg.sender];
        require(cur >= amount, "ERC20: allowance");
        unchecked { _approve(from, msg.sender, cur - amount); }
        _transfer(from, to, amount);
        return true;
    }

    /* ERC-677-like */
    function transferAndCall(address to, uint256 amount, bytes calldata data) external returns (bool) {
        _transfer(msg.sender, to, amount);
        if (_isContract(to)) {
            bool ok = ITokenReceiver(to).onTokenTransfer(msg.sender, amount, data);
            require(ok, "onTokenTransfer failed");
        }
        return true;
    }

    /* internals */
    function _transfer(address from, address to, uint256 amt) internal {
        require(to != address(0), "to=0");
        uint256 b = _bal[from]; require(b >= amt, "balance");
        unchecked { _bal[from] = b - amt; }
        _bal[to] += amt;
        emit Transfer(from, to, amt);
    }

    function _approve(address owner, address spender, uint256 amt) internal {
        require(owner != address(0) && spender != address(0), "zero");
        _allow[owner][spender] = amt;
        emit Approval(owner, spender, amt);
    }

    function _mint(address to, uint256 amt) internal {
        require(to != address(0), "to=0");
        totalSupply += amt;
        _bal[to] += amt;
        emit Transfer(address(0), to, amt);
    }

    function _isContract(address a) private view returns (bool) { return a.code.length > 0; }
}
