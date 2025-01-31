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
}

const VehicleTrips = ({ token, logout, ownerID }) => {
  const { vehicleID } = useParams();
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState([]);
  const [error, setError] = useState('');
  const [decryptor, setDecryptor] = useState(null);
  const [isDecrypted, setIsDecrypted] = useState(false);

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
    const fetchTripsWithPrimes = async () => {
      try {
        setLoading(true);
  
        // Récupère les trajets depuis l'API
        const res = await axios.get(`${API_URL}/queryTripsByVehicleID/${vehicleID}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
  
        const fetchedTrips = res.data.data.map((trip) => ({
          ...trip,
          isEncrypted: true, // Marquer les trajets récupérés comme chiffrés
        }));
  
        // Récupère les primes associées aux trips
        const primesRes = await axios.get(`${API_URL}/queryPrimesByVehicleID/${vehicleID}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        console.log(primesRes)
        const primesMap = primesRes.data.primes.reduce((map, prime) => {

          map[prime.tripID] = prime.prime; // Associer la prime au TripID
  
          return map;
  
        }, {});
        console.log("primesMap...")
        console.log(primesMap)

  
        // Ne met à jour les trajets que s'ils ne sont pas déjà déchiffrés
        setTrips((prevTrips) => {
          if (prevTrips.some((prevTrip) => !prevTrip.isEncrypted)) {
            return prevTrips; // Ne pas écraser si des trajets sont déjà déchiffrés
          }
  
          return fetchedTrips.map((trip) => ({
            ...trip,
            hasPrime: primesMap[trip.tripID] !== undefined, // Vérifier si une prime est présente
            primeValue: primesMap[trip.tripID] || null, // Ajouter la valeur de la prime si disponible
          }));
        });
  
        setError('');
      } catch (err) {
        console.error('Error fetching trips and primes:', err);
        setError('Failed to fetch trips and primes.');
      } finally {
        setLoading(false);
      }
    };
  
    fetchTripsWithPrimes();
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
            primeValue: trip.hasPrime ? decryptor.decrypt(trip.primeValue) : null,
            isEncrypted: false, // Marquer comme déchiffré
          };
        } catch (err) {
          console.error('Error decrypting trip:', trip, err);
          return trip; // Retourner le trajet original en cas d'erreur
        }
      });
      console.log("decryptedTrips")
      console.log(decryptedTrips)
      setTrips(decryptedTrips);
      setIsDecrypted(true);
    }
  }, [decryptor, trips, isDecrypted]);
  
  

  if (loading) {
    return <div className="spinner-border text-primary" role="status"></div>;
  }

  if (error) {
    return <div className="alert alert-danger">{error}</div>;
  }

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Trips for Vehicle ID: {vehicleID}</h2>
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
                    <span className="badge bg-success">Available</span>
                    <span> - Value: {trip.primeValue}</span>
                  </>
                ) : (
                  <>
                    <span className="badge bg-warning">Encrypted</span>
                    <button 
                      className="btn btn-primary btn-sm ms-2" 
                      onClick={() => console.log(`Sent trip: ${trip.tripID}`)}
                    >
                      Send Decrypted Premium
                    </button>
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
