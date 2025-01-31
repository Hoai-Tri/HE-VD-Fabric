import React, { useState, useEffect } from 'react';
import axios from 'axios';
import JSBI from 'jsbi'; // Use JSBI for big integer operations

const API_URL = 'http://localhost:3001/api';

// Définition du déchiffreur
function modPow(base, exponent, modulus) {
  base = JSBI.remainder(base, modulus);
  let result = JSBI.BigInt(1);

  while (JSBI.greaterThan(exponent, JSBI.BigInt(0))) {
    if (JSBI.equal(JSBI.remainder(exponent, JSBI.BigInt(2)), JSBI.BigInt(1))) {
      result = JSBI.remainder(JSBI.multiply(result, base), modulus);
    }
    exponent = JSBI.divide(exponent, JSBI.BigInt(2));
    base = JSBI.remainder(JSBI.multiply(base, base), modulus);
  }

  return result;
}


class Decryptor {
  constructor(p, q, n) {
    this.p = JSBI.BigInt(p);
    this.q = JSBI.BigInt(q);
    this.n = JSBI.BigInt(n);
    this.nsquare = JSBI.multiply(this.n, this.n);
    this.lambda = this.lcm(JSBI.subtract(this.p, JSBI.BigInt(1)), JSBI.subtract(this.q, JSBI.BigInt(1)));
    this.mu = this.modInverse(this.lambda, this.n);
  }

  lcm(a, b) {
    return JSBI.divide(JSBI.multiply(a, b), this.gcd(a, b));
  }

  gcd(a, b) {
    if (JSBI.equal(b, JSBI.BigInt(0))) return a;
    return this.gcd(b, JSBI.remainder(a, b));
  }

  modInverse(a, m) {
    const [gcd, x] = this.extendedGCD(a, m);
    if (!JSBI.equal(gcd, JSBI.BigInt(1))) throw new Error('Modular inverse does not exist');
    return JSBI.remainder(JSBI.add(x, m), m);
  }

  extendedGCD(a, b) {
    if (JSBI.equal(b, JSBI.BigInt(0))) return [a, JSBI.BigInt(1), JSBI.BigInt(0)];
    const [gcd, x1, y1] = this.extendedGCD(b, JSBI.remainder(a, b));
    return [gcd, y1, JSBI.subtract(x1, JSBI.multiply(JSBI.divide(a, b), y1))];
  }

  decrypt(C) {
    const u = modPow(JSBI.BigInt(C), this.lambda, this.nsquare);
    const L_u = JSBI.divide(JSBI.subtract(u, JSBI.BigInt(1)), this.n);
    return JSBI.remainder(JSBI.multiply(L_u, this.mu), this.n).toString();
  }
}

const CarSimulation = ({ token, ownerID }) => {
  const [formData, setFormData] = useState({
    behaviour: '',
    vehID: '',
  });
  const [vehicles, setVehicles] = useState([]); // Liste des véhicules
  const [response, setResponse] = useState('');
  const [error, setError] = useState('');
  const [tripData, setTripData] = useState(null);
  const [publicKey, setPublicKey] = useState(null);
  const [premiumResponse, setPremiumResponse] = useState('');
  const [decryptor, setDecryptor] = useState(null);

  useEffect(() => {
    const fetchVehicles = async () => {
      try {
        const res = await axios.get(`${API_URL}/queryOwnerDetails/${ownerID}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setVehicles(res.data.data.Vehicles || []);
      } catch (err) {
        console.error('Failed to fetch vehicles:', err);
        setError('Failed to fetch vehicles.');
      }
    };
    fetchVehicles();
  }, [ownerID, token]);

  useEffect(() => {
    const initializeDecryptor = async () => {
      try {
        const storedKeys = JSON.parse(localStorage.getItem('userKeys')) || {};
        const userKeys = storedKeys[ownerID]; // Utilise ownerID pour récupérer les clés
        if (!userKeys || !userKeys.P || !userKeys.Q) {
          setError('Les clés cryptographiques sont manquantes pour cet utilisateur.');
          return;
        }
  
        const res = await axios.get(`${API_URL}/queryVerifier/${ownerID}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
  
        const n = res.data.data.n;
        const decryptorInstance = new Decryptor(userKeys.P, userKeys.Q, n);
        setDecryptor(decryptorInstance);
      } catch (error) {
        setError('Erreur lors de l\'initialisation du déchiffreur.');
        console.error(error);
      }
    };
    initializeDecryptor();
  }, [ownerID, token]);

  // Fetch the public key (N) for encryption
  useEffect(() => {
    const fetchPublicKey = async () => {
      try {
        const res = await axios.get(`${API_URL}/queryVerifier/${ownerID}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setPublicKey(res.data.data.n);
      } catch (err) {
        console.error('Failed to fetch public key:', err);
        setError('Failed to fetch public key for encryption.');
      }
    };
    fetchPublicKey();
  }, [ownerID, token]);

  // Parameters for simulation
  const behaviourParams = {
    bonne: {
      speeding: [0, 5],
      hard_accelerations: [0, 2],
      emergency_brakes: [0, 1],
      unsafe_distance: [0, 10],
      high_risk_zones: [0, 5],
      traffic_signal_compliance: [9, 10],
      night_driving: [0, 10]
    },
    moyenne: {
      speeding: [5, 20],
      hard_accelerations: [2, 5],
      emergency_brakes: [1, 3],
      unsafe_distance: [10, 30],
      high_risk_zones: [5, 15],
      traffic_signal_compliance: [8, 9],
      night_driving: [10, 30]
    },
    mauvaise: {
      speeding: [20, 50],
      hard_accelerations: [5, 15],
      emergency_brakes: [3, 10],
      unsafe_distance: [30, 60],
      high_risk_zones: [15, 30],
      traffic_signal_compliance: [5, 8],
      night_driving: [30, 60]
    },
  };

  // Generate random trip data
  const generateTripData = () => {
    const params = behaviourParams[formData.behaviour];
    if (!params) {
      setError('Invalid behaviour selected.');
      return;
    }

    const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

    const tripData = {
      tripID: `T${randomInt(1000, 9999)}`,
      date: new Date().toISOString().split('T')[0],
      vehID: formData.vehID,
      speeding: randomInt(...params.speeding),
      hard_accelerations: randomInt(...params.hard_accelerations),
      emergency_brakes: randomInt(...params.emergency_brakes),
      unsafe_distance: randomInt(...params.unsafe_distance),
      high_risk_zones: randomInt(...params.high_risk_zones),
      traffic_signal_compliance: randomInt(...params.traffic_signal_compliance),
      night_driving: randomInt(...params.night_driving),
      mileage: parseInt(formData.mileage, 10),
    };

    setTripData(tripData);
    setError('');
  };

  function modPow(base, exponent, modulus) {
    base = JSBI.remainder(base, modulus);
    let result = JSBI.BigInt(1);
  
    while (JSBI.greaterThan(exponent, JSBI.BigInt(0))) {
      if (JSBI.equal(JSBI.remainder(exponent, JSBI.BigInt(2)), JSBI.BigInt(1))) {
        result = JSBI.remainder(JSBI.multiply(result, base), modulus);
      }
      exponent = JSBI.divide(exponent, JSBI.BigInt(2));
      base = JSBI.remainder(JSBI.multiply(base, base), modulus);
    }
  
    return result;
  }
  

  // Encrypt data using the public key (N)
  const encrypt = (m, n) => {
    const N = JSBI.BigInt(n);
    const nsquare = JSBI.multiply(N, N);

    const mBigInt = JSBI.BigInt(m);
    const r = JSBI.BigInt(Math.floor(Math.random() * (JSBI.toNumber(N) - 1)) + 1); // Random r in range [1, N-1]

    const rExpN = modPow(r, N, nsquare);
    const mN = JSBI.multiply(mBigInt, N);
    const c = JSBI.remainder(JSBI.multiply(JSBI.add(JSBI.BigInt(1), mN), rExpN), nsquare);

    return c.toString(); // Return the encrypted value as a string
  };

  // Encrypt the trip data
  const encryptTripData = (data, n) => {
    return {
      ...data,
      speeding: encrypt(data.speeding, n),
      hard_accelerations: encrypt(data.hard_accelerations, n),
      emergency_brakes: encrypt(data.emergency_brakes, n),
      unsafe_distance: encrypt(data.unsafe_distance, n),
      high_risk_zones: encrypt(data.high_risk_zones, n),
      traffic_signal_compliance: encrypt(data.traffic_signal_compliance, n),
      night_driving: encrypt(data.night_driving, n),
      mileage: encrypt(data.mileage, n),
    };
  };

  const calculateInsurancePremium = async (vehicleID, tripID, criteriaWeightsID) => {
    try {
      const res = await axios.post(
        `${API_URL}/calculateInsurancePremium`,
        { vehicleID, tripID, criteriaWeightsID },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setPremiumResponse(`Calculated Premium: ${decryptor.decrypt(res.data.result.prime_totale)/100} .-`);
    } catch (err) {
      console.error('Erreur lors du calcul de la prime:', err);
      setPremiumResponse('Erreur lors du calcul de la prime.');
    }
  };  

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!tripData) {
      setError('Generate trip data before submitting.');
      return;
    }

    if (!publicKey) {
      setError('Public key not available for encryption.');
      return;
    }

    try {
      const encryptedData = encryptTripData(tripData, publicKey);
      const res = await axios.post(`${API_URL}/addEncryptedTripData`, encryptedData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setResponse(res.data.message || 'Simulation successful!');
      setTripData(null);
      setError('');

      // Appel au calcul de la prime après soumission
      const vehicleID = formData.vehID;
      const tripID = tripData.tripID;
      const criteriaWeightsID = vehicles.find((v) => v.VehicleID === vehicleID)?.Contracts?.[0]?.CriteriaWeightsID;

      if (criteriaWeightsID) {
        await calculateInsurancePremium(vehicleID, tripID, criteriaWeightsID);
      } else {
        setPremiumResponse('Aucun contract trouvé pour ce véhicule.');
      }
    } catch (err) {
      console.error(err);
      setError('Failed to submit encrypted trip data. Please try again.');
    }
  };
  return (
    <div className="container mt-4">
      <h2>Trip Simulator</h2>
      {error && <div className="alert alert-danger">{error}</div>}
      {response && <div className="alert alert-success">{response}</div>}
      {premiumResponse && <div className="alert alert-info">{premiumResponse}</div>}
      <form className="p-4 border rounded shadow-sm">
        <div className="mb-3">
          <label htmlFor="vehID" className="form-label">Vehicle</label>
          <select
            id="vehID"
            className="form-select"
            value={formData.vehID}
            onChange={(e) => setFormData({ ...formData, vehID: e.target.value })}
            required
          >
            <option value="">Select a vehicle</option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.VehicleID} value={vehicle.VehicleID}>
                {vehicle.VehicleID}
              </option>
            ))}
          </select>
        </div>
        <div className="mb-3">
          <label htmlFor="behaviour" className="form-label">Behaviour</label>
          <select
            id="behaviour"
            className="form-select"
            value={formData.behaviour}
            onChange={(e) => setFormData({ ...formData, behaviour: e.target.value })}
            required
          >
            <option value="">Select a behaviour</option>
            <option value="bonne">Good</option>
            <option value="moyenne">Average</option>
            <option value="mauvaise">Bad</option>
          </select>
        </div>
        <div className="mb-3">
          <label htmlFor="mileage" className="form-label">Mileage</label>
          <input
            type="number"
            id="mileage"
            className="form-control"
            value={formData.mileage}
            onChange={(e) => setFormData({ ...formData, mileage: e.target.value })}
            required
          />
        </div>
        <button
          type="button"
          className="btn btn-secondary mb-3 w-100"
          onClick={generateTripData}
        >
          Generate trip data
        </button>
        {tripData && (
          <div className="mb-3">
            <h4>Trip summary</h4>
            <pre>{JSON.stringify(tripData, null, 2)}</pre>
          </div>
        )}
        <button
          type="submit"
          className="btn btn-primary w-100"
          onClick={handleSubmit}
        >
          Submit encrypted data
        </button>
      </form>
    </div>
  );
};

export default CarSimulation;
