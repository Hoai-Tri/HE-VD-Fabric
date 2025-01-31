import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import JSBI from 'jsbi';

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

  compute_r_prime(R) {
    console.log("computing N inverse mod lambda")
    const N_inverse_mod_lambda = this.modInverse(this.n, this.lambda)
    console.log("computing modPow(JSBI.BigInt(R), N_inverse_mod_lambda, this.n)")
    const r_prime = modPow(JSBI.BigInt(R), N_inverse_mod_lambda, this.n)
    
    return JSBI.toNumber(r_prime)
  }

}

const VehicleTrips = ({ token, logout, ownerID, role  }) => {
  const { vehicleID } = useParams();
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState([]);
  const [error, setError] = useState('');
  const [decryptor, setDecryptor] = useState(null);
  const [isDecrypted, setIsDecrypted] = useState(false);
  const [criteriaWeightsID, setCriteriaWeightsID] = useState(null);


  useEffect(() => {
    const fetchCriteriaWeightsID = async () => {
      try {
        const res = await axios.get(`${API_URL}/queryOwnerDetails/${ownerID}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
  
        if (res.data.data.Vehicles.length > 0 && res.data.data.Vehicles[0].Contracts.length > 0) {
          setCriteriaWeightsID(res.data.data.Vehicles[0].Contracts[0].CriteriaWeightsID);
        }
      } catch (err) {
        console.error('Failed to fetch criteriaWeightsID:', err);
        setError('Failed to fetch criteriaWeightsID.');
      }
    };
  
    fetchCriteriaWeightsID();
  }, [ownerID, token]);
  

  useEffect(() => {
    const initializeDecryptor = async () => {
      try {
        const storedKeys = JSON.parse(localStorage.getItem('userKeys')) || {};
        const userKeys = storedKeys[ownerID]; // Utilise ownerID pour récupérer les clés
        if (!userKeys || !userKeys.P || !userKeys.Q) {
          setError('Les clés cryptographiques sont manquantes pour cet utilisateur.');
          setLoading(false);
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
  

  useEffect(() => {
    const fetchTripsWithPrimesAndEncryptedResults = async () => {
      try {
        setLoading(true);
  
        // Récupérer les trajets
        const tripsRes = await axios.get(`${API_URL}/queryTripsByVehicleID/${vehicleID}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
  
        const fetchedTrips = tripsRes.data.data.map((trip) => ({
          ...trip,
          isEncrypted: true, // Marquer les trajets comme chiffrés
        }));
  
        // Récupérer les primes déchiffrées disponibles
        const primesRes = await axios.get(`${API_URL}/queryPrimesByVehicleID/${vehicleID}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const primes = primesRes.data?.primes || [];
        const primesMap = primes.reduce((map, prime) => {
          map[prime.tripID] = prime.prime; // Associer la prime au TripID
          return map;
        }, {});
  
        // Récupérer les résultats de primes chiffrées
        const encryptedRes = await axios.get(`${API_URL}/queryEncryptedResultsByVehicleID/${vehicleID}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        console.log('encryptedRes')
        console.log(encryptedRes)
  
        const encryptedPrimesMap = encryptedRes.data.encryptedResults.reduce((map, encrypted) => {
          map[encrypted.tripID] = {
            prime: encrypted.prime_totale, 
            r: encrypted.r,
          };
          return map;
        }, {});
  
        setTrips((prevTrips) => {
          if (prevTrips.some((prevTrip) => !prevTrip.isEncrypted)) {
            return prevTrips; // Ne pas écraser si des trajets sont déjà déchiffrés
          }
  
          return fetchedTrips.map((trip) => ({
            ...trip,
            hasPrime: primesMap[trip.tripID] !== undefined, // Prime déjà déchiffrée
            primeValue: primesMap[trip.tripID] || null, 
            hasEncryptedPrime: encryptedPrimesMap[trip.tripID] !== undefined, 
            encryptedPrime: encryptedPrimesMap[trip.tripID]?.prime || null,
            rValue: encryptedPrimesMap[trip.tripID]?.r || null,
          }));
        });
  
        setError('');
      } catch (err) {
        console.error('Error fetching trips and premiums:', err);
        setError('Failed to fetch trips and premiums.');
      } finally {
        setLoading(false);
      }
    };
  
    fetchTripsWithPrimesAndEncryptedResults();
  }, [vehicleID, token]);

  
  useEffect(() => {
    if (decryptor && !isDecrypted && trips.length > 0) {
      const decryptedTrips = trips.map((trip) => {
        if (!trip.isEncrypted) return trip; // Ignorer les trajets déjà déchiffrés
  
        try {
          return {
            ...trip,
            speeding: decryptor.decrypt(trip.speeding),
            hard_accelerations: decryptor.decrypt(trip.hard_accelerations),
            emergency_brakes: decryptor.decrypt(trip.emergency_brakes),
            unsafe_distance: decryptor.decrypt(trip.unsafe_distance),
            high_risk_zones: decryptor.decrypt(trip.high_risk_zones),
            traffic_signal_compliance: decryptor.decrypt(trip.traffic_signal_compliance),
            night_driving: decryptor.decrypt(trip.night_driving),
            mileage: decryptor.decrypt(trip.mileage),
            primeValue: trip.hasEncryptedPrime ? decryptor.decrypt(trip.encryptedPrime) : null,
            isEncrypted: false, // Marquer comme déchiffré
          };
        } catch (err) {
          console.error('Error decrypting trip:', trip, err);
          return trip; // Retourner le trajet original en cas d'erreur
        }
      });
  
      setTrips(decryptedTrips);
      setIsDecrypted(true);
    }
  }, [decryptor, trips, isDecrypted]);
  
  const calculateInsurancePremium = async (vehicleID, tripID, criteriaWeightsID) => {
    try {
      const res = await axios.post(
        `${API_URL}/calculateInsurancePremium`,
        { vehicleID, tripID, criteriaWeightsID },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const result_decrypted = decryptor.decrypt(res.data.result.prime_totale)
      alert(`Prime calculée avec succès pour le trip ${tripID}: ${result_decrypted}`);    
      // Met à jour l'état pour refléter la nouvelle prime
      setTrips((prevTrips) =>
        prevTrips.map((trip) =>
          trip.tripID === tripID ? { ...trip, primeValue: result_decrypted, hasEncryptedPrime:true } : trip
        )
      );
    } catch (err) {
      console.error('Erreur lors du calcul de la prime:', err);
      alert('Erreur lors du calcul de la prime.');
    }
  };

  const send_r_prime = async (resultID,R) => {
    const rPrime = decryptor.compute_r_prime(R)
    try {
      console.log("this is parameters")
      console.log(resultID)
      console.log(rPrime)
      const res = await axios.post(
        `${API_URL}/decryptInsurancePremiumAndUpdate`,
        { resultID, rPrime },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const result_message = res.data.message
      alert(result_message);    
      // Met à jour l'état pour refléter la nouvelle prime
      setTrips((prevTrips) =>
        prevTrips.map((trip) =>
          trip.tripID === resultID ? { ...trip, hasPrime: true } : trip
        )
      );
    } catch (err) {
      console.error('Erreur lors du calcul de la prime:', err);
      alert('Erreur lors du calcul de la prime.');
    }
  };
  
  
  

  if (loading) {
    return <div className="spinner-border text-primary" role="status"></div>;
  }

  if (error) {
    return <div className="alert alert-danger">{error}</div>;
  }

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Trips for {vehicleID}</h2>
        <button className="btn btn-secondary" onClick={logout}>
          Logout
        </button>
      </div>
      {trips.length > 0 ? (
        <div>
          <h3>List of Trips</h3>
          {trips.map((trip, index) => (
            <div key={index} className="card mb-3 shadow-sm">
              <div className="card-body">
                <h5>Trip ID: {trip.tripID}</h5>
                <p>
                  <strong>Date:</strong> {trip.date}
                </p>
                <p>
                  <strong>Premium Status:</strong>{' '}
                  {trip.hasPrime ? (
                    <>
                      <span>{trip.primeValue/100}.- </span>
                      <span className="badge bg-success">Decrypted and Verified</span>
                    </>
                  ) : trip.hasEncryptedPrime && trip.primeValue != undefined ? (
                    <>
                      <span>{trip.primeValue/100}.- </span>
                      <span className="badge bg-success">Decrypted locally</span>
                      {role === 'client' && (
                        <button
                          className="btn btn-primary btn-sm ms-2"
                          onClick={() => send_r_prime(trip.tripID, trip.rValue)}
                        >
                          Submit Derived Decryption Key
                        </button>
                      )}
                    </>
                  ) : (
                    
                    <>
                    <span className="badge bg-danger">No Premium</span>
                    {/* <button 
                      className="btn btn-primary btn-sm ms-2" 
                      onClick={() => calculateInsurancePremium(vehicleID, trip.tripID, criteriaWeightsID)}
                    >
                      Calculate Premium
                    </button> */}
                  </>
                  )}
                </p>
                <p>
                  <strong>Speeding Events:</strong> {trip.speeding}{' '}
                  {trip.isEncrypted ? (
                    <span className="badge bg-warning">Encrypted</span>
                  ) : (
                    <span className="badge bg-success">Decrypted</span>
                  )}
                </p>
                <p>
                  <strong>Hard Accelerations:</strong> {trip.hard_accelerations}{' '}
                  {trip.isEncrypted ? (
                    <span className="badge bg-warning">Encrypted</span>
                  ) : (
                    <span className="badge bg-success">Decrypted</span>
                  )}
                </p>
                <p>
                  <strong>Emergency Brakes:</strong> {trip.emergency_brakes}{' '}
                  {trip.isEncrypted ? (
                    <span className="badge bg-warning">Encrypted</span>
                  ) : (
                    <span className="badge bg-success">Decrypted</span>
                  )}
                </p>
                <p>
                  <strong>Unsafe Distance:</strong> {trip.unsafe_distance}{' '}
                  {trip.isEncrypted ? (
                    <span className="badge bg-warning">Encrypted</span>
                  ) : (
                    <span className="badge bg-success">Decrypted</span>
                  )}
                </p>
                <p>
                  <strong>High Risk Zones:</strong> {trip.high_risk_zones}{' '}
                  {trip.isEncrypted ? (
                    <span className="badge bg-warning">Encrypted</span>
                  ) : (
                    <span className="badge bg-success">Decrypted</span>
                  )}
                </p>
                <p>
                  <strong>Traffic Signal Compliance:</strong> {trip.traffic_signal_compliance}{' '}
                  {trip.isEncrypted ? (
                    <span className="badge bg-warning">Encrypted</span>
                  ) : (
                    <span className="badge bg-success">Decrypted</span>
                  )}
                </p>
                <p>
                  <strong>Night Driving:</strong> {trip.night_driving}{' '}
                  {trip.isEncrypted ? (
                    <span className="badge bg-warning">Encrypted</span>
                  ) : (
                    <span className="badge bg-success">Decrypted</span>
                  )}
                </p>
                <p>
                  <strong>Mileage:</strong> {trip.mileage}{' '}
                  {trip.isEncrypted ? (
                    <span className="badge bg-warning">Encrypted</span>
                  ) : (
                    <span className="badge bg-success">Decrypted</span>
                  )}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="alert alert-info">No trips found for this vehicle.</div>
      )}
    </div>
  );
};

export default VehicleTrips;
