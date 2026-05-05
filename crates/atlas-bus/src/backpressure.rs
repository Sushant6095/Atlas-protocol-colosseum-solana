//! Backpressure monitor (directive §4).
//!
//! Tracks the slot lag of the bus consumer relative to the highest-slot
//! event published. If the lag exceeds `degraded_threshold_slots` on the
//! commitment channel, the pipeline transitions to `Degraded` mode:
//!   - rebalances are blocked
//!   - monitoring continues
//!   - oncall is paged via the `Degraded` event the orchestrator consumes

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum BusMode {
    Healthy,
    Degraded { lag_slots: u64 },
}

#[derive(Clone, Copy, Debug)]
pub struct BackpressurePolicy {
    pub degraded_threshold_slots: u64,
    pub recovery_threshold_slots: u64,
}

impl Default for BackpressurePolicy {
    fn default() -> Self {
        Self {
            degraded_threshold_slots: 64,
            recovery_threshold_slots: 16,
        }
    }
}

pub struct BackpressureMonitor {
    policy: BackpressurePolicy,
    highest_published_slot: u64,
    highest_consumed_slot: u64,
    mode: BusMode,
}

impl BackpressureMonitor {
    pub fn new(policy: BackpressurePolicy) -> Self {
        Self {
            policy,
            highest_published_slot: 0,
            highest_consumed_slot: 0,
            mode: BusMode::Healthy,
        }
    }

    pub fn record_published(&mut self, slot: u64) {
        if slot > self.highest_published_slot {
            self.highest_published_slot = slot;
        }
        self.recompute();
    }

    pub fn record_consumed(&mut self, slot: u64) {
        if slot > self.highest_consumed_slot {
            self.highest_consumed_slot = slot;
        }
        self.recompute();
    }

    fn recompute(&mut self) {
        let lag = self
            .highest_published_slot
            .saturating_sub(self.highest_consumed_slot);
        match self.mode {
            BusMode::Healthy => {
                if lag > self.policy.degraded_threshold_slots {
                    self.mode = BusMode::Degraded { lag_slots: lag };
                }
            }
            BusMode::Degraded { .. } => {
                if lag <= self.policy.recovery_threshold_slots {
                    self.mode = BusMode::Healthy;
                } else {
                    self.mode = BusMode::Degraded { lag_slots: lag };
                }
            }
        }
    }

    pub fn mode(&self) -> BusMode {
        self.mode
    }

    pub fn is_degraded(&self) -> bool {
        matches!(self.mode, BusMode::Degraded { .. })
    }

    pub fn block_rebalances(&self) -> bool {
        self.is_degraded()
    }

    pub fn lag_slots(&self) -> u64 {
        self.highest_published_slot
            .saturating_sub(self.highest_consumed_slot)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn healthy_when_consumer_keeps_up() {
        let mut m = BackpressureMonitor::new(BackpressurePolicy::default());
        for s in 0..100u64 {
            m.record_published(s);
            m.record_consumed(s);
        }
        assert_eq!(m.mode(), BusMode::Healthy);
        assert!(!m.block_rebalances());
    }

    #[test]
    fn degraded_when_lag_exceeds_threshold() {
        let mut m = BackpressureMonitor::new(BackpressurePolicy::default());
        for s in 0..100u64 {
            m.record_published(s);
        }
        m.record_consumed(0);
        // lag = 99 > 64 → Degraded
        assert!(matches!(m.mode(), BusMode::Degraded { .. }));
        assert!(m.block_rebalances());
    }

    #[test]
    fn recovers_below_recovery_threshold() {
        let mut m = BackpressureMonitor::new(BackpressurePolicy::default());
        for s in 0..100u64 {
            m.record_published(s);
        }
        m.record_consumed(20);
        assert!(matches!(m.mode(), BusMode::Degraded { .. }));
        // lag drops below recovery_threshold=16 → Healthy
        m.record_consumed(95);
        assert_eq!(m.mode(), BusMode::Healthy);
    }

    #[test]
    fn hysteresis_prevents_thrash() {
        let mut m = BackpressureMonitor::new(BackpressurePolicy::default());
        for s in 0..100u64 {
            m.record_published(s);
        }
        m.record_consumed(20); // lag 79 → Degraded
        assert!(m.is_degraded());
        m.record_consumed(50); // lag 49 — between recovery (16) and degraded (64) → stays Degraded
        assert!(m.is_degraded());
        m.record_consumed(85); // lag 14 → Healthy
        assert_eq!(m.mode(), BusMode::Healthy);
    }
}
