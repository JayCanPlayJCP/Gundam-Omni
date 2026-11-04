'use strict';
// AI style profiles; each opponent deck is piloted with the profile that maximizes ITS win rate (best-response opponents).
module.exports = {
  balanced: { aggression: 1.0, removalThreshold: 1.4, exposureWeight: 0.45 },
  aggro: { aggression: 1.45, removalThreshold: 1.2, exposureWeight: 0.3 },
  control: { aggression: 0.75, removalThreshold: 0.9, exposureWeight: 0.6 },
  tempo: { aggression: 1.2, removalThreshold: 0.8, exposureWeight: 0.4 },
  hyper: { aggression: 1.9, removalThreshold: 1.6, exposureWeight: 0.2 },
};
