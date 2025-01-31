import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import JSBI from 'jsbi';
import { useNavigate } from 'react-router-dom';

const API_URL = 'http://localhost:3001/api';
// max safe int 9007199254740991



const OwnerDetails = ({ token, logout }) => { // Ajout de la prop logout
  const { ownerID } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
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
  
  

  useEffect(() => {
    console.log('Updated ownerData:', ownerData);
  }, [ownerData]);
  
  
  
  
  
  

  // Charger les détails du propriétaire
  useEffect(() => {
    console.log("Fetching...");
    
    const fetchOwnerDetails = async () => {
      try {
        setLoading(true);
    
        const res = await axios.get(`${API_URL}/queryOwnerDetails/${ownerID}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        // Vérifier si les données sont nulles ou non définies
        const fetchedData = res.data?.data || {};
        
        // Si `Vehicles` n'existe pas, initialisez-le en tant que tableau vide
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
  
}, [ownerID, token]);




  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setKeys((prevKeys) => ({ ...prevKeys, [name]: value }));
  };


  if (loading) {
    return <div className="spinner-border text-primary" role="status"></div>;
  }

  if (error) {
    return <div className="alert alert-danger">{error}</div>;
  }

  const { MonthPrimes, Primes, Vehicles } = ownerData;

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Owner Details for {ownerID}</h2>
        <button className="btn btn-secondary" onClick={logout}>
          Logout
        </button>
      </div>


      {/* Month Primes Section */}
      {/* MonthPrimes && MonthPrimes.length > 0 && (
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
                <strong>Date:</strong> {prime.Date} | <strong>Value:</strong> {prime.Prime/100}.-
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
            {vehicle.isEncrypted ? <span className="badge bg-warning">Encrypted</span> : <span className="badge bg-success">Decrypted</span>}
          </p>
          <p>
            <strong>Purchase Mileage:</strong> {vehicle.VehicleDetails?.purchase_mileage || 'N/A'}{' '}
            {vehicle.isEncrypted ? <span className="badge bg-warning">Encrypted</span> : <span className="badge bg-success">Decrypted</span>}
          </p>
          <p>
            <strong>Year:</strong> {vehicle.VehicleDetails?.year || 'N/A'}{' '}
            {vehicle.isEncrypted ? <span className="badge bg-warning">Encrypted</span> : <span className="badge bg-success">Decrypted</span>}
          </p>
          {vehicle.Contracts && vehicle.Contracts.length > 0 ? (
          <div>
            <button
                className="btn btn-primary"
                onClick={() =>
                    alert(
                        `Contract Details:\nContract ID: ${vehicle.Contracts[0].ContractID}\nStart Date: ${vehicle.Contracts[0].StartDate}\nEnd Date: ${vehicle.Contracts[0].EndDate}\nCriteria Weights: ${JSON.stringify(vehicle.Contracts[0].CriteriaWeights, null, 2)}`
                    )
                }
                style={{ marginRight: '10px' }}
            >
                View Contract
            </button>
            <button
                    className="btn btn-primary"
                    onClick={() => navigate(`/vehicle/${vehicle.VehicleID}`)}
                >
                    View Trips
            </button>
          </div>
          ) : (
            <div>
              <p>No Contract Available</p>
              <button
                className="btn btn-primary"
                onClick={() => navigate(`/addInsuranceContract/${ownerID}/${vehicle.VehicleID}`)}
                style={{ marginRight: '10px' }}
              >
                Add Contract
              </button>
            </div>
          )}
          
        </div>
      </div>
    ))}
  </div>
)}

    </div>
  );
};

export default OwnerDetails;
