// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "solmate/src/utils/SafeTransferLib.sol";
import "solmate/src/tokens/ERC20.sol";

import './interfaces/IUniswapV2Pair.sol';
import './interfaces/IWETH.sol';
import './Decimal.sol';
// import "hardhat/console.sol";


contract UltimaBalancer {
    address public owner;
    using Decimal for Decimal.D256;

    modifier onlyOwner() virtual {
        require(msg.sender == owner, "UNAUTHORIZED");
        _;
    }

    constructor(address _owner) {
        owner = _owner;
    }

    receive() external payable {}

    fallback() external payable {}

    function destroy() external onlyOwner {
        selfdestruct(payable(owner));
    }

    function withdraw(address token) external onlyOwner {
        uint256 balance = address(this).balance;
        if (balance > 0) {
            payable(owner).transfer(balance);
        }

        balance = ERC20(token).balanceOf(address(this));
        if (balance > 0) {
            ERC20(token).transfer(owner, balance);
        }
    }

    struct ArbParams {
        address pool0;
        address pool1;
        address baseToken;
        uint256 count;
    }
 
    struct OrderedReserves {
        uint256 a1;
        uint256 b1;
        uint256 a2;
        uint256 b2;
    }
    /// 199000 gas with swaps 
    /// 72091 gas without swaps
    /// 71490 vs 75158 getReserves vs tokenBalanceOf (4 calls )
    /// 87960 gas +1 safeTransfer
    function executes(ArbParams calldata params) external onlyOwner {
        (address lowerPool, address higherPool, OrderedReserves memory orderedReserves) = getOrderedReserves(params.pool0, params.pool1);
        
        uint256 borrowAmount = calcBorrowAmount(orderedReserves);
        uint256 debtAmount = getAmountIn(borrowAmount, orderedReserves.a1, orderedReserves.b1);
        uint256 baseTokenOutAmount = getAmountOut(borrowAmount, orderedReserves.b2, orderedReserves.a2);

        SafeTransferLib.safeTransfer(ERC20(params.baseToken), lowerPool, debtAmount);
        IUniswapV2Pair(lowerPool).swap(borrowAmount, 0, higherPool, new bytes(0));
        IUniswapV2Pair(higherPool).swap(0, baseTokenOutAmount, address(this), new bytes(0));

        for (uint256 i = 0; i <= params.count; i++) {
            address(this).balance;
        }
    }

    /// @dev Compare price denominated in quote token between two pools
    /// We borrow base token by using flash swap from lower price pool and sell them to higher price pool
    /// 37736 gas before added function tokenBalanceOf
    // function getOrderedReserves(
    //     address pool0, 
    //     address pool1
    // )
    //     internal
    //     view
    //     returns (
    //         address lowerPool,
    //         address higherPool,
    //         OrderedReserves memory orderedReserves
    //     )
    // {
    //     (uint256 pool0Reserve0, uint256 pool0Reserve1, ) = IUniswapV2Pair(pool0).getReserves();
    //     (uint256 pool1Reserve0, uint256 pool1Reserve1, ) = IUniswapV2Pair(pool1).getReserves();
        
    //     (uint256 price0, uint256 price1) = (pool0Reserve1 * 10**18 / pool0Reserve0, pool1Reserve1 * 10**18 / pool1Reserve0);
    //     // console.log("prices", price0, price1); // 333333333333333333 | 328939476759044421
    //     // console.log("pricescheck", price0 < price1); 
                
    //     if (price0 < price1) {
    //         (lowerPool, higherPool) = (pool0, pool1);
    //         (orderedReserves.a1, orderedReserves.b1, orderedReserves.a2, orderedReserves.b2) = (pool0Reserve1, pool0Reserve0, pool1Reserve1, pool1Reserve0);
    //     } else {
    //         (lowerPool, higherPool) = (pool1, pool0);
    //         (orderedReserves.a1, orderedReserves.b1, orderedReserves.a2, orderedReserves.b2) = (pool1Reserve1, pool1Reserve0, pool0Reserve1, pool0Reserve0);
    //     }
    //     // console.log("lower pool", lowerPool, higherPool);
    //     // console.log(orderedReserves.a1, orderedReserves.a2, orderedReserves.b1,orderedReserves.b2);
    // }

    function getOrderedReserves(
        address pool0, 
        address pool1
    )
        internal
        view
        returns (
            address lowerPool,
            address higherPool,
            OrderedReserves memory orderedReserves
        )
    {
        (uint256 pool0Reserve0, uint256 pool0Reserve1, ) = IUniswapV2Pair(pool0).getReserves();
        (uint256 pool1Reserve0, uint256 pool1Reserve1, ) = IUniswapV2Pair(pool1).getReserves();

        // Calculate the price denominated in quote asset token
        (Decimal.D256 memory price0, Decimal.D256 memory price1) = (Decimal.from(pool0Reserve1).div(pool0Reserve0), Decimal.from(pool1Reserve1).div(pool1Reserve0));

        if (price0.lessThan(price1)) {
            (lowerPool, higherPool) = (pool0, pool1);
            (orderedReserves.a1, orderedReserves.b1, orderedReserves.a2, orderedReserves.b2) = (pool0Reserve1, pool0Reserve0, pool1Reserve1, pool1Reserve0);
        } else {
            (lowerPool, higherPool) = (pool1, pool0);
            (orderedReserves.a1, orderedReserves.b1, orderedReserves.a2, orderedReserves.b2) = (pool1Reserve1, pool1Reserve0, pool0Reserve1, pool0Reserve0);
        }
    }

    /// @notice Calculate how much profit we can by arbitraging between two pools
    /// 66361 gas
    function getProfit(ArbParams calldata params) public view returns (uint256 profit) {
        OrderedReserves memory orderedReserves;
        (,, orderedReserves) = getOrderedReserves(params.pool0, params.pool1);
        
        uint256 borrowAmount = calcBorrowAmount(orderedReserves);
        uint256 debtAmount = getAmountIn(borrowAmount, orderedReserves.a1, orderedReserves.b1);
        uint256 baseTokenOutAmount = getAmountOut(borrowAmount, orderedReserves.b2, orderedReserves.a2);
        if (baseTokenOutAmount < debtAmount) {
            profit = 0;
        } else {
            profit = baseTokenOutAmount - debtAmount;
        }
    }        

    function calcBorrowAmount(OrderedReserves memory reserves) internal pure returns (uint256 amount) {
        uint256 min1 = reserves.a1 < reserves.b1 ? reserves.a1 : reserves.b1;
        uint256 min2 = reserves.a2 < reserves.b2 ? reserves.a2 : reserves.b2;
        uint256 min = min1 < min2 ? min1 : min2;

        uint256 d;
        if (min > 1e24) {
            d = 1e20;
        } else if (min > 1e23) {
            d = 1e19;
        } else if (min > 1e22) {
            d = 1e18;
        } else if (min > 1e21) {
            d = 1e17;
        } else if (min > 1e20) {
            d = 1e16;
        } else if (min > 1e19) {
            d = 1e15;
        } else if (min > 1e18) {
            d = 1e14;
        } else if (min > 1e17) {
            d = 1e13;
        } else if (min > 1e16) {
            d = 1e12;
        } else if (min > 1e15) {
            d = 1e11;
        } else {
            d = 1e10;
        }

        (int256 a1, int256 a2, int256 b1, int256 b2) =
            (int256(reserves.a1 / d), int256(reserves.a2 / d), int256(reserves.b1 / d), int256(reserves.b2 / d));

        int256 a = a1 * b1 - a2 * b2;
        int256 b = 2 * b1 * b2 * (a1 + a2);
        int256 c = b1 * b2 * (a1 * b2 - a2 * b1);

        (int256 x1, int256 x2) = calcSolutionForQuadratic(a, b, c);

        // 0 < x < b1 and 0 < x < b2
        require((x1 > 0 && x1 < b1 && x1 < b2) || (x2 > 0 && x2 < b1 && x2 < b2), 'order');
        amount = (x1 > 0 && x1 < b1 && x1 < b2) ? uint256(x1) * d : uint256(x2) * d;
    }

    /// @dev find solution of quadratic equation: ax^2 + bx + c = 0, only return the positive solution
    function calcSolutionForQuadratic(
        int256 a,
        int256 b,
        int256 c
    ) internal pure returns (int256 x1, int256 x2) {
        int256 m = b**2 - 4 * a * c;
        require(m > 0, 'Complex number');

        int256 sqrtM = int256(sqrt(uint256(m)));
        x1 = (-b + sqrtM) / (2 * a);
        x2 = (-b - sqrtM) / (2 * a);
    }

    function sqrt(uint256 n) internal pure returns (uint256 res) {
        assert(n > 1);

        // The scale factor is a crude way to turn everything into integer calcs.
        // Actually do (n * 10 ^ 4) ^ (1/2)
        uint256 _n = n * 10**6;
        uint256 c = _n;
        res = _n;

        uint256 xi;
        while (true) {
            xi = (res + c / res) / 2;
            // don't need be too precise to save gas
            if (res - xi < 1000) {
                break;
            }
            res = xi;
        }
        res = res / 10**3;
    }
    // function sqrt(uint256 x) internal pure returns (uint256 z) {
    //     /// @solidity memory-safe-assembly
    //     assembly {
    //         let y := x // We start y at x, which will help us make our initial estimate.

    //         z := 181 // The "correct" value is 1, but this saves a multiplication later.

    //         if iszero(lt(y, 0x10000000000000000000000000000000000)) {
    //             y := shr(128, y)
    //             z := shl(64, z)
    //         }
    //         if iszero(lt(y, 0x1000000000000000000)) {
    //             y := shr(64, y)
    //             z := shl(32, z)
    //         }
    //         if iszero(lt(y, 0x10000000000)) {
    //             y := shr(32, y)
    //             z := shl(16, z)
    //         }
    //         if iszero(lt(y, 0x1000000)) {
    //             y := shr(16, y)
    //             z := shl(8, z)
    //         }

    //         z := shr(18, mul(z, add(y, 65536))) // A mul() is saved from starting z at 181.

    //         z := shr(1, add(z, div(x, z)))
    //         z := shr(1, add(z, div(x, z)))
    //         z := shr(1, add(z, div(x, z)))
    //         z := shr(1, add(z, div(x, z)))
    //         z := shr(1, add(z, div(x, z)))
    //         z := shr(1, add(z, div(x, z)))
    //         z := shr(1, add(z, div(x, z)))

    //         z := sub(z, lt(div(x, z), z))
    //     }
    // }

    function getAmountOut(
        uint256 input_amount,
        uint256 input_reserve,
        uint256 output_reserve
    )
        internal
        pure
        returns (uint256 output_amount)
    {
        assembly {
            let input_amount_with_fee := mul(input_amount, 997)
            let numerator := mul(input_amount_with_fee, output_reserve)
            let denominator := add(mul(input_reserve, 1000), input_amount_with_fee)
            output_amount := div(numerator, denominator)
        }
    }

    function getAmountIn(
        uint256 out_amount,
        uint256 input_reserve,
        uint256 output_reserve
    )
        internal
        pure
        returns (uint256 amountIn)
    {
        assembly {
            let numerator := mul(mul(input_reserve, out_amount), 1000)
            let denominator := mul(sub(output_reserve, out_amount), 997)
            amountIn := add(div(numerator, denominator), 1)
        }
    }
}