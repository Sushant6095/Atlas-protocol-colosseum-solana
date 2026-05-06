//! Token-2022 transfer-fee math (directive §1.2).
//!
//! Withdrawals account for any non-zero `TransferFeeConfig` so users
//! see net amounts in the pre-sign simulation. Computation matches
//! the on-chain rule: fee = `min(amount × bps / 10_000, max_fee)`,
//! net = amount - fee.

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct TransferFee {
    pub gross: u64,
    pub fee: u64,
    pub net: u64,
}

pub fn net_amount_after_fee(amount: u64, fee_bps: u32, max_fee: u64) -> TransferFee {
    let raw_fee = (amount as u128 * fee_bps as u128) / 10_000;
    let fee = raw_fee.min(max_fee as u128) as u64;
    let net = amount.saturating_sub(fee);
    TransferFee { gross: amount, fee, net }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn zero_fee_passes_through() {
        let r = net_amount_after_fee(1_000_000, 0, u64::MAX);
        assert_eq!(r.net, 1_000_000);
        assert_eq!(r.fee, 0);
    }

    #[test]
    fn proportional_fee_is_correct() {
        // 50 bps = 0.5 % of 1_000_000 = 5_000.
        let r = net_amount_after_fee(1_000_000, 50, u64::MAX);
        assert_eq!(r.fee, 5_000);
        assert_eq!(r.net, 995_000);
    }

    #[test]
    fn max_fee_caps_proportional() {
        let r = net_amount_after_fee(1_000_000_000, 100, 100);
        assert_eq!(r.fee, 100);
        assert_eq!(r.net, 1_000_000_000 - 100);
    }

    #[test]
    fn fee_above_amount_does_not_underflow() {
        let r = net_amount_after_fee(50, 10_000, u64::MAX);
        assert_eq!(r.net, 0);
    }
}
