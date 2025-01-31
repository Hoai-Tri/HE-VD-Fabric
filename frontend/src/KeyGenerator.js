import { randomInt } from "crypto";

// Génère un nombre premier
const generatePrime = (min = 1000, max = 10000) => {
  const isPrime = (num) => {
    if (num < 2) return false;
    for (let i = 2, sqrt = Math.sqrt(num); i <= sqrt; i++) {
      if (num % i === 0) return false;
    }
    return true;
  };

  while (true) {
    const candidate = randomInt(min, max);
    if (isPrime(candidate)) return candidate;
  }
};

// Génère les paramètres P, Q, N, Lambda et N^2
const generateValidParams = () => {
  while (true) {
    const P = generatePrime();
    const Q = generatePrime();

    if (P === Q) continue;

    const N = P * Q;
    const gcd = (a, b) => (!b ? a : gcd(b, a % b));
    const lcm = (a, b) => (a * b) / gcd(a, b);
    const Lambda = lcm(P - 1, Q - 1);

    if (gcd(N, Lambda) === 1) {
      return { P, Q, N, Lambda, N_square: N ** 2 };
    }
  }
};
