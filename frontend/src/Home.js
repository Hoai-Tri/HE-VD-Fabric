import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import JSBI from 'jsbi';
import { useNavigate } from 'react-router-dom';

const API_URL = 'http://localhost:3001/api';

const Home = ({ token, ownerID, logout }) => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [ownerData, setOwnerData] = useState({
      MonthPrimes: [],
      Primes: [],
      Vehicles: [],
    });
  
    const [keys, setKeys] = useState({ P: '', Q: '' }); // État pour les clés
    const [keysExist, setKeysExist] = useState(false); // Indique si les clés existent
    const [hasKeys, setHasKeys] = useState(false); // Indique globalement si des clés sont détectées
    const [decryptor, setDecryptor] = useState(null);
    const [isDecrypted, setIsDecrypted] = useState(false);
  
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
  
      computeRPrime(R) {
        const N_inverse_mod_lambda = this.modInverse(this.n, this.lambda);
        return JSBI.remainder(JSBI.exponentiate(JSBI.BigInt(R), N_inverse_mod_lambda), this.n);
      }
      
  
      decrypt(C) {
        // console.log( this.lambda)
        // console.log( this.C)
        // console.log( this.nsquare)
        const u = modPow(JSBI.BigInt(C), this.lambda, this.nsquare);
        const L_u = JSBI.divide(JSBI.subtract(u, JSBI.BigInt(1)), this.n);
        return JSBI.remainder(JSBI.multiply(L_u, this.mu), this.n);
      }
    }
  
  
    // Fonction pour vérifier l'existence des clés dans LocalStorage
    const checkKeysExistence = () => {
      const storedKeys = JSON.parse(localStorage.getItem('userKeys')) || {};
      const userKeys = storedKeys[ownerID];
      return userKeys && userKeys.P && userKeys.Q;
    };
  
    // Utiliser useEffect pour mettre à jour l'état hasKeys
    useEffect(() => {
      if (checkKeysExistence()) {
        setKeysExist(true);
        setHasKeys(true); // Les clés existent, met à jour hasKeys
      } else {
        setKeysExist(false);
        setHasKeys(false); // Aucune clé détectée
      }
    }, [ownerID]);
  
    useEffect(() => {
      const initializeDecryptor = async () => {
        try {
          const storedKeys = JSON.parse(localStorage.getItem('userKeys')) || {};
          const userKeys = storedKeys[ownerID];
          if (!userKeys || !userKeys.P || !userKeys.Q) {
            console.error('Keys not found in localStorage');
            return;
          }
    
          // Récupération de n depuis l'API
          const res = await axios.get(`${API_URL}/queryVerifier/${ownerID}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const { n } = res.data.data.n;
          console.log("This is supposed to be n")
          console.log(res.data.data.n)
    
          // Initialisation du Déchiffreur
          const decryptor = new Decryptor(userKeys.P, userKeys.Q, res.data.data.n);
          console.log('Decryptor initialized:', decryptor);
    
          // Exemple de déchiffrement
          setDecryptor(decryptor); // Stockez dans un état si nécessaire
        } catch (error) {
          console.error('Error initializing decryptor:', error);
        }
      };
    
      if (hasKeys) {
        initializeDecryptor();
      }
    }, [hasKeys, ownerID, token]);
    
    useEffect(() => {
      if (decryptor && !isDecrypted && ownerData?.Vehicles?.length > 0) {
        const decryptedVehicles = ownerData.Vehicles.map((vehicle) => {
          try {
            return {
              ...vehicle,
              VehicleDetails: {
                ...vehicle.VehicleDetails,
                vehicle_type: vehicle.VehicleDetails?.vehicle_type
                  ? decryptor.decrypt(vehicle.VehicleDetails.vehicle_type).toString()
                  : vehicle.VehicleDetails?.vehicle_type,
                purchase_mileage: vehicle.VehicleDetails?.purchase_mileage
                  ? decryptor.decrypt(vehicle.VehicleDetails.purchase_mileage).toString()
                  : vehicle.VehicleDetails?.purchase_mileage,
                year: vehicle.VehicleDetails?.year
                  ? (JSBI.subtract(JSBI.BigInt(2025),decryptor.decrypt(vehicle.VehicleDetails.year))).toString()
                  : vehicle.VehicleDetails?.year,
              },
              isEncrypted: false, // Marquer comme déchiffré
            };
          } catch (error) {
            console.error('Error decrypting vehicle:', vehicle, error);
            return vehicle; // Retournez l'objet d'origine en cas d'erreur
          }
        });
    
        setOwnerData((prevData) => ({
          ...prevData,
          Vehicles: decryptedVehicles,
        }));
    
        setIsDecrypted(true);
      }
    }, [decryptor, isDecrypted, ownerData]);
    
  
    useEffect(() => {
      console.log('Updated ownerData:', ownerData);
    }, [ownerData]);
    
    
    
    
    
    
    const hasFetched = useRef(false);
  
    // Charger les détails du propriétaire
    useEffect(() => {
        if (!isDecrypted && !hasFetched.current) {
          console.log("Fetching...");
          hasFetched.current = true;
          
          const fetchOwnerDetails = async () => {
            try {
              setLoading(true);
          
              const res = await axios.get(`${API_URL}/queryOwnerDetails/${ownerID}`, {
                headers: { Authorization: `Bearer ${token}` },
              });
      
              // Vérifier si les données sont nulles ou non définies
              const fetchedData = res.data?.data || {};
              
              // Si `Vehicles` n'existe pas, l'initialiser en tant que tableau vide
              const updatedVehicles = (fetchedData.Vehicles || []).map((vehicle) => ({
                ...vehicle,
                isEncrypted: true, // Ajout de l'indicateur
              }));
      
              // Mettre à jour les données du propriétaire avec des valeurs par défaut si elles sont nulles
              setOwnerData({
                MonthPrimes: fetchedData.MonthPrimes || [],
                Primes: fetchedData.Primes || [],
                Vehicles: updatedVehicles,
              });
              setError('');
            } catch (err) {
              console.error('Error fetching owner details:', err);
              setError('Failed to fetch owner details.');
            } finally {
              setLoading(false);
            }
          };
      
          fetchOwnerDetails();
        }
      }, [isDecrypted, ownerID, token]);
      
  
  
  
  
    const handleInputChange = (e) => {
      const { name, value } = e.target;
      setKeys((prevKeys) => ({ ...prevKeys, [name]: value }));
    };

    const handleUploadKeys = (event) => {
      const file = event.target.files[0];
      if (!file) {
          alert("Veuillez sélectionner un fichier !");
          return;
      }
  
      const reader = new FileReader();
      reader.onload = (e) => {
          try {
              const uploadedKeys = JSON.parse(e.target.result);
              if (uploadedKeys.P && uploadedKeys.Q) {
                  // Met à jour les clés
                  setKeys({
                      P: uploadedKeys.P,
                      Q: uploadedKeys.Q,
                  });
                  alert("Keys successfully loaded!");
              } else {
                  alert("JSON file is invalid or missing P and Q keys.");
              }
          } catch (error) {
              alert("Error loading JSON file. Make sure the format is correct.");
          }
      };
      reader.readAsText(file);
  };
  
  
    const handleSubmitKeys = (e) => {
      e.preventDefault();
  
      // Sauvegarder les clés dans LocalStorage
      const storedKeys = JSON.parse(localStorage.getItem('userKeys')) || {};
      storedKeys[ownerID] = keys;
      localStorage.setItem('userKeys', JSON.stringify(storedKeys));
  
      alert('Keys successfully added.');
      setKeysExist(true); // Mettre à jour l'état pour cacher le formulaire
      setHasKeys(true); // Mettre à jour globalement
    };
  
    if (loading) {
      return <div className="spinner-border text-primary" role="status"></div>;
    }
  
    if (error) {
      return <div className="alert alert-danger">{error}</div>;
    }
  
    const { MonthPrimes, Primes, Vehicles } = ownerData;
    
    const handleVehicleClick = (vehicleID) => {
        navigate(`/vehicle/${vehicleID}`);
      };
    
    return (
      <div className="container mt-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h2>Welcome back, {ownerID}!</h2>
          <button className="btn btn-secondary" onClick={logout}>
            Logout
          </button>
          <button
            className="btn btn-primary mt-3"
            onClick={() => navigate('/simulate')}
          >
            Go to Simulation Page
          </button>
        </div>
  
        {/* Formulaire d'ajout des clés */}
        {!keysExist && (
          <div className="mb-4">
            <h3>Add your cryptographic keys</h3>
            <form onSubmit={handleSubmitKeys} className="p-3 border rounded shadow-sm">
              <div className="mb-3">
                <label htmlFor="P" className="form-label">P </label>
                <input
                  type="number"
                  className="form-control"
                  id="P"
                  name="P"
                  value={keys.P}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="mb-3">
                <label htmlFor="Q" className="form-label">Q </label>
                <input
                  type="number"
                  className="form-control"
                  id="Q"
                  name="Q"
                  value={keys.Q}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="mb-3">
                <label htmlFor="upload" className="form-label">Loading keys from a JSON file</label>
                <input
                    type="file"
                    accept="application/json"
                    className="form-control"
                    onChange={handleUploadKeys}
                />
            </div>
              <button type="submit" className="btn btn-primary">Register keys</button>
            </form>
          </div>
        )}
  
        {/* Affichage d'une bannière si les clés sont détectées */}
        {hasKeys && (
          <div className="alert alert-success">
            Cryptographic keys are correctly configured.
          </div>
        )}
  
        {/* Month Primes Section */}
        {/*MonthPrimes && MonthPrimes.length > 0 && (
          <div>
            <h3>Month Primes</h3>
            <div className="row">
              {MonthPrimes.map((prime, index) => (
                <div key={index} className="col-md-4">
                  <div className="card mb-3 shadow-sm">
                    <div className="card-body">
                      <h5 className="card-title">Vehicle ID: {prime.VehicleID}</h5>
                      <p className="card-text"><strong>Month:</strong> {prime.Month}</p>
                      <p className="card-text"><strong>Prime:</strong> {prime.Prime}</p>
                      <p className="card-text"><strong>Year:</strong> {prime.Year}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )*/}
  
        {/* Primes Section */}
        {Primes && Primes.length > 0 && (
          <div>
            <h3>Premiums</h3>
            <ul className="list-group mb-3">
              {Primes.map((prime, index) => (
                <li key={index} className="list-group-item">
                  <strong>Date:</strong> {prime.Date} | <strong>Value:</strong> {prime.Prime/100}.- | <strong>TripID:</strong> {prime.TripID}
                </li>
              ))}
            </ul>
          </div>
        )}
  
        {/* Vehicles Section */}
        {Vehicles && Vehicles.length > 0 && (
            <div>
                <h3>Vehicles</h3>
                {Vehicles.map((vehicle, index) => (
                    <div key={index} className="card mb-3 shadow-sm">
                        <div className="card-body">
                            <h5>Vehicle ID: {vehicle.VehicleID}</h5>
                            <p>
                                <strong>Vehicle Type:</strong> {vehicle.VehicleDetails?.vehicle_type || 'N/A'}{' '}
                                {vehicle.isEncrypted ? (
                                    <span className="badge bg-warning">Encrypted</span>
                                ) : (
                                    <span className="badge bg-success">Decrypted</span>
                                )}
                            </p>
                            <p>
                                <strong>Purchase Mileage:</strong> {vehicle.VehicleDetails?.purchase_mileage || 'N/A'}{' '}
                                {vehicle.isEncrypted ? (
                                    <span className="badge bg-warning">Encrypted</span>
                                ) : (
                                    <span className="badge bg-success">Decrypted</span>
                                )}
                            </p>
                            <p>
                                <strong>Year:</strong> {vehicle.VehicleDetails?.year || 'N/A'}{' '}
                                {vehicle.isEncrypted ? (
                                    <span className="badge bg-warning">Encrypted</span>
                                ) : (
                                    <span className="badge bg-success">Decrypted</span>
                                )}
                            </p>
                            {vehicle.Contracts && vehicle.Contracts.length > 0 ? (
                                <button
                                    className="btn btn-primary"
                                    onClick={() =>
                                        alert(
                                            `Contract Details:\nContract ID: ${vehicle.Contracts[0].ContractID}\nStart Date: ${vehicle.Contracts[0].StartDate}\nEnd Date: ${vehicle.Contracts[0].EndDate}\nCriteria Weights: ${JSON.stringify(vehicle.Contracts[0].CriteriaWeights, null, 2)}`
                                        )
                                    }
                                >
                                    View Contract
                                </button>
                            ) : (
                                <p>No Contract Available</p>
                            )}
                            <p></p>
                            <button
                                    className="btn btn-primary"
                                    onClick={() => handleVehicleClick(vehicle.VehicleID)
                                    }
                                >
                                    View Trips
                                </button>
                        </div>
                    </div>
                ))}
            </div>
        )}

        </div>
        
  );
};

export default Home;
