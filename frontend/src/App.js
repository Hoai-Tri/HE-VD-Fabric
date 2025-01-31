import React, { useState, useEffect } from 'react';
import axios from 'axios';
import 'bootstrap/dist/css/bootstrap.min.css';
import { BrowserRouter as Router, Route, Routes, Link } from 'react-router-dom';
import OwnerDetails from './OwnerDetails';
import VehicleTrips from './VehicleTrips';
import CarSimulation from './CarSimulation';
import AddVehicle from './AddVehicle';
import { useNavigate } from 'react-router-dom';
import Home from './Home';
import CreateCriteriaWeight from './CreateCriteriaWeight';
import AddInsuranceContract from './AddInsuranceContract';


const API_URL = 'http://localhost:3001/api';

const App = () => {
  const [role, setRole] = useState('');
  const [token, setToken] = useState('');
  const [response, setResponse] = useState('');
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [hasKey, setHasKey] = useState(null); // null = inconnu, true = clé existante, false = pas de clé
  const [clientDetails, setClientDetails] = useState([]); // Stocke les détails des clients
  const [needsPasswordChange, setNeedsPasswordChange] = useState(false);
  const [canGenerateKeys, setCanGenerateKeys] = useState(false);
  const [generatedKeys, setGeneratedKeys] = useState(null);
  const navigate = useNavigate();
  const [keyLoading, setKeyLoading] = useState(false);
  const [keysGenerated, setKeysGenerated] = useState(false); 
  const [showNavigateButton, setShowNavigateButton] = useState(false); 
  const [directLogin, setDirectLogin] = useState(false); 

  // Enregistrer les clés dans le Local Storage
  const saveKeysToLocalStorage = (ownerID, keys) => {
    const storedKeys = JSON.parse(localStorage.getItem('userKeys')) || {};
    storedKeys[ownerID] = keys;
    localStorage.setItem('userKeys', JSON.stringify(storedKeys));
  };

  // Récupérer les clés depuis le Local Storage
  const getKeysFromLocalStorage = (ownerID) => {
    const storedKeys = JSON.parse(localStorage.getItem('userKeys')) || {};
    return storedKeys[ownerID] || null;
  };

  // Supprimer les clés d'un utilisateur du Local Storage
  const removeKeysFromLocalStorage = (ownerID) => {
    const storedKeys = JSON.parse(localStorage.getItem('userKeys')) || {};
    delete storedKeys[ownerID];
    localStorage.setItem('userKeys', JSON.stringify(storedKeys));
  };


  const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

  // Vérifie si un nombre est premier
  const isPrime = (num) => {
    if (num < 2) return false;
    for (let i = 2, sqrt = Math.sqrt(num); i <= sqrt; i++) {
      if (num % i === 0) return false;
    }
    return true;
  };

  // Génère un nombre premier dans un intervalle donné
  const generatePrime = (min = 1000, max = 10000) => {
    while (true) {
      const candidate = randomInt(min, max);
      if (isPrime(candidate)) return candidate;
    }
  };

  // Calcul du PGCD
  const gcd = (a, b) => (!b ? a : gcd(b, a % b));

  // Calcul du PPCM
  const lcm = (a, b) => (a * b) / gcd(a, b);

  // Génération des paramètres P, Q, N, Lambda et N²
  const generateValidParams = () => {
    while (true) {
      const P = generatePrime();
      const Q = generatePrime();

      if (P === Q) continue;

      const N = P * Q;
      const Lambda = lcm(P - 1, Q - 1);

      if (gcd(N, Lambda) === 1) {
        return { P, Q, N, Lambda, N_square: N ** 2 };
      }
    }
  };

  const downloadKeysAsJSON = () => {
    if (!generatedKeys) {
        alert("No key generated to download !");
        return;
    }

    const keysToDownload = {
        P: generatedKeys.P,
        Q: generatedKeys.Q,
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(keysToDownload, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    const filename = `keys_${formData.ownerID || 'unknown'}.json`;
    downloadAnchorNode.setAttribute("download", filename);
    document.body.appendChild(downloadAnchorNode); // Requis pour Firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();};

  

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const authenticate = async (userID, userSecret) => {
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/authenticate`, { userID, userSecret });
      setToken(res.data.token);
      setRole(res.data.identityType);
      setFormData((prev) => ({ ...prev, ownerID: userID }));
  
      // Vérifiez les clés existantes dans le Local Storage
      const existingKeys = getKeysFromLocalStorage(userID);
      if (existingKeys) {
        console.log('Existing keys found :', existingKeys);
        setGeneratedKeys(existingKeys); // Charger les clés dans l'état
      } else {
        console.log('Aucune clé existante trouvée.');
      }
  
      alert(`Authenticated as ${res.data.identityType}`);
    } catch (error) {
      console.error('Authentication failed:', error);
      alert('Authentication failed. Check console for details.');
    } finally {
      setLoading(false);
    }
  };
  

  const logout = () => {
    setRole('');
    setToken('');
    setResponse('');
    setFormData({});
    setHasKey(null);
    setClientDetails([]);
    setGeneratedKeys(null); // Réinitialiser l'état des clés
    removeKeysFromLocalStorage(formData.ownerID); // Supprimer les clés locales

    alert('Log Out Successfully');
    navigate('/'); // Redirige vers la page principale
  };

  const callAPI = async (endpoint, method = 'POST', data = {}) => {
    setLoading(true);
    try {
      const res = await axios({
        method,
        url: `${API_URL}/${endpoint}`,
        headers: { Authorization: `Bearer ${token}` },
        ...(method !== 'GET' && { data }),
      });
      setResponse(res.data);
      return res.data;
    } catch (error) {
      console.error(`Error calling ${endpoint}:`, error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const checkIfKeyExists = async () => {
    try {
      await callAPI(`queryVerifier/${encodeURIComponent(formData.ownerID)}`, 'GET');
      setHasKey(true);
      setNeedsPasswordChange(false);
    } catch {
      setHasKey(false);
      setNeedsPasswordChange(true);
    }
  };
  
  const ChangePasswordForm = ({ onPasswordChanged, token, setCanGenerateKeys }) => {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
  
    const handleSubmit = async (e) => {
      e.preventDefault();
      setLoading(true);
      setErrorMessage('');
      setSuccessMessage('');
      try {
        await axios.post(
          `${API_URL}/changePassword/${encodeURIComponent(formData.ownerID)}`,
          { currentPassword, newPassword },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setSuccessMessage('Password successfully changed.');
        onPasswordChanged();
        setCanGenerateKeys(true); // Activer le bouton de génération de clé
      } catch (error) {
        setErrorMessage(
          error.response?.data?.error || 'An error occurred while changing the password.'
        );
      } finally {
        setLoading(false);
      }
    };
  
    return (
      <div className="mt-3 p-3 border rounded shadow-sm">
        <h4>Change your password</h4>
        {successMessage && <div className="alert alert-success">{successMessage}</div>}
        {errorMessage && <div className="alert alert-danger">{errorMessage}</div>}
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label">Current password</label>
            <input
              type="password"
              className="form-control"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div className="mb-3">
            <label className="form-label">New password</label>
            <input
              type="password"
              className="form-control"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Loading...' : 'Change your password'}
          </button>
        </form>
      </div>
    );
  };
  
  
  

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (role === 'client' && formData.ownerID) {
          // Vérifie si la clé existe
          await checkIfKeyExists();
          
          // Récupère les détails du propriétaire
          console.log("checking queryOwnerDetails")
          await callAPI(`queryOwnerDetails/${formData.ownerID}`, 'GET');
        } else if (role === 'insurer') {
          // Récupère les détails des clients pour un assureur
          await fetchClientDetails();
        }
      } catch (error) {
        console.error('Error fetching client data:', error);
      }
    };
  
    fetchData();
  }, [role, formData.ownerID]);

  const fetchClientDetails = async () => {
    try {
      setLoading(true);
      const clientDetailsRes = await axios.get(`${API_URL}/getAllClientDetails`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setClientDetails(clientDetailsRes.data.allClientDetails); // Met à jour les clients dans l'état
    } catch (error) {
      console.error('Error retrieving customer details :', error);
    } finally {
      setLoading(false);
    }
  };

  
  


  const AddUserForm = ({ token, onUserAdded }) => {
    const [formData, setFormData] = useState({
      name: '',
      password: '',
      role: '',
      dateofbirth: '',
      address: '',
    });
    const [loading, setLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
  
    const handleInputChange = (e) => {
      setFormData({
        ...formData,
        [e.target.name]: e.target.value,
      });
    };
  
    const handleSubmit = async (e) => {
      e.preventDefault();
      setLoading(true);
      setSuccessMessage('');
      setErrorMessage('');
      try {
        const response = await axios.post(
          `${API_URL}/addUser`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        setSuccessMessage('User successfully added.');
  
        // Appeler la fonction de rafraîchissement des clients après ajout
        if (onUserAdded) {
          onUserAdded();
        }
      } catch (error) {
        setErrorMessage(
          error.response?.data?.error || 'UAn error occurred while adding the user.'
        );
      } finally {
        setLoading(false);
      }
    };
  
    return (
      <div className="mt-4 p-4 border rounded shadow-sm">
        <h3>Register a user</h3>
        {successMessage && <div className="alert alert-success">{successMessage}</div>}
        {errorMessage && <div className="alert alert-danger">{errorMessage}</div>}
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label">Name</label>
            <input
              name="name"
              className="form-control"
              value={formData.name}
              onChange={handleInputChange}
              required
            />
          </div>
          <div className="mb-3">
            <label className="form-label">Password</label>
            <input
              name="password"
              type="password"
              className="form-control"
              value={formData.password}
              onChange={handleInputChange}
              required
            />
          </div>
          <div className="mb-3">
            <label className="form-label">Role</label>
            <select
              name="role"
              className="form-select"
              value={formData.role}
              onChange={handleInputChange}
              required
            >
              <option value="">Select a role</option>
              <option value="client">Client</option>
              <option value="insurer">Insurer</option>
              <option value="admin">Administrator</option>
            </select>
          </div>
          <div className="mb-3">
            <label className="form-label">Date of Birth</label>
            <input
              name="dateofbirth"
              type="date"
              className="form-control"
              value={formData.dateofbirth}
              onChange={handleInputChange}
              required
            />
          </div>
          <div className="mb-3">
            <label className="form-label">Address</label>
            <input
              name="address"
              className="form-control"
              value={formData.address}
              onChange={handleInputChange}
              required
            />
          </div>
          <button className="btn btn-primary w-100" type="submit" disabled={loading}>
            {loading ? 'Registering...' : 'Register a user'}
          </button>
        </form>
      </div>
    );
  };
  
  
  



  const ClientOptions = ({
    needsPasswordChange,
    onPasswordChanged,
    token,
    canGenerateKeys,
    setCanGenerateKeys,
  }) => {
    const navigate = useNavigate();
    useEffect(() => {
      if (hasKey && !needsPasswordChange) {
        navigate('/home');
      }
    }, [hasKey, formData.ownerID, needsPasswordChange]); // Dépendances pour relancer l'effet si elles changent
  
    const handleGenerateKeys = async () => {
      setKeyLoading(true);
      try {
        const keys = generateValidParams();
        setGeneratedKeys(keys);
        
  
        await axios.post(
          `${API_URL}/addVerifier`,
          {
            ownerID: formData.ownerID,
            n: keys.N.toString(),
            nsquare: keys.N_square.toString(),
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
  
        saveKeysToLocalStorage(formData.ownerID, keys);
        alert('Keys successfully generated.');
        setKeysGenerated(true);
        setShowNavigateButton(true); // Affiche le bouton après la génération des clés
      } catch (error) {
        console.error('Error during key generation:', error);
        alert('An error occured.');
      } finally {
        setKeyLoading(false);
      }
    };
  
    if (needsPasswordChange) {
      return (
        <ChangePasswordForm
          onPasswordChanged={onPasswordChanged}
          token={token}
          setCanGenerateKeys={setCanGenerateKeys}
        />
      );
    }
    return (
      <div>
        {canGenerateKeys ? (
          <div>
            <h4>Generate your keys</h4>
            <button
              className={`btn ${keyLoading || keysGenerated ? 'btn-secondary disabled' : 'btn-primary'} w-100`}
              onClick={handleGenerateKeys}
              disabled={keyLoading || keysGenerated}
            >
              {keyLoading ? 'Keys generation in progress..' : keysGenerated ? 'Generated keys' : 'Generate keys'}
            </button>
  
            {keysGenerated && !keyLoading && (
              <div className="mt-3 alert alert-success">
                Keys successfully generated. Please note the following information.
              </div>
            )}
  
            {generatedKeys && !keyLoading && (
              <div className="mt-3">
                <h5>Generated keys</h5>
                <p><strong>P:</strong> {generatedKeys.P}</p>
                <p><strong>Q:</strong> {generatedKeys.Q}</p>
                <p><strong>N:</strong> {generatedKeys.N}</p>
                <p><strong>Lambda:</strong> {generatedKeys.Lambda}</p>
                <p><strong>N²:</strong> {generatedKeys.N_square}</p>
              </div>
            )}
            {keysGenerated && (
                <div>
                    <button className="btn btn-info mt-3 w-100" onClick={downloadKeysAsJSON}>
                    Download keys (JSON)
                    </button>
                </div>
            )}
  
            {showNavigateButton && (
              <button
                className="btn btn-success mt-3 w-100"
                onClick={() => navigate(`/home`)}
              >
                I took note of the information and downloaded the file.
              </button>
            )}
          </div>
        ) : (
          <p>Loading...</p>
        )}
      </div>
    );
  };
  
  
  
  
  
  
  

  const renderClientDetailsForInsurer = () => {
    
    return (
      <div>
        <h3>All Client Details</h3>
        {console.log("clients details ", clientDetails)}
        {clientDetails.map((client, index) => (
          
          <div className="card mb-3 shadow-sm">
            <div className="card-body">
              <h5>Name: {client.name}</h5>
              <p><strong>Address:</strong> {client.address}</p>
              <p><strong>Date of birth:</strong> {client.dateofbirth}</p>
              <p><strong>Vehicles:</strong> {client.infos.Vehicles && client.infos.Vehicles.length > 0 ? client.infos.Vehicles.length : 'No vehicles'}</p>
              <div>
                <Link to={`/add-vehicle/${client.name}`} className="btn btn-primary" style={{ marginRight: '10px' }}>
                  Add Vehicle
                </Link>
                <Link to={`/owner/${client.name}`} key={index} className="btn btn-primary">
                  View Details
                </Link>
              </div>
            </div>
          </div>
          
        ))}
        {/* Ajouter le formulaire d'ajout d'utilisateur */}
        <AddUserForm token={token} onUserAdded={fetchClientDetails} />
      </div>
    );
  };
  const handleRefresh = async () => {
    setLoading(true);
    try {
      if (role === 'client' && formData.ownerID) {
        await checkIfKeyExists();
        await callAPI(`queryOwnerDetails/${formData.ownerID}`, 'GET');
      } else if (role === 'insurer') {
        await fetchClientDetails();
      }
    } catch (error) {
      console.error("Erreur lors de l'actualisation des données :", error);
    } finally {
      setLoading(false);
    }
  };
  
  
  
  
  
  

  return (
    <div className="container mt-4">
      {role === "insurer" && (
                  <div>
                    <h1 className="text-center">Insurance Platform: Insurer View</h1>
                    <button onClick={handleRefresh} className="btn btn-primary" disabled={loading}>
                    {loading ? 'Refreshing...' : 'Refresh Data'}
                  </button>
                  </div>
                  )}
      {role === "client" && (
        <h1 className="text-center">Insurance Platform: Vehicle Owner View</h1>
                )}
      

      <Routes>
        <Route
          path="/"
          element={
            !role ? (
              <form
                className="mt-4 p-4 border rounded shadow-sm"
                onSubmit={(e) => {
                  e.preventDefault();
                  authenticate(formData.userID, formData.userSecret);
                }}
              >
                <h2 className="mb-3">Authentication</h2>
                <input name="userID" className="form-control mb-3" placeholder="User ID" onChange={handleInputChange} />
                <input
                  name="userSecret"
                  type="password"
                  className="form-control mb-3"
                  placeholder="User Secret"
                  onChange={handleInputChange}
                />
                <button className="btn btn-primary w-100" type="submit">
                  Login
                </button>
              </form>
            ) : (
              <div className="container mt-4">
                <div className="d-flex justify-content-between align-items-center mb-4">
                  <button className="btn btn-secondary mb-3" onClick={logout}>
                    Logout
                  </button>
                  {role === "insurer" && (
                    <div className="mt-3">
                    <Link to="/create-criteria-weight" className="btn btn-primary">
                      Weighting Criteria
                    </Link>
                    </div>
                  )}
                </div>  
                {role === "client" && (
                  <ClientOptions
                    needsPasswordChange={needsPasswordChange}
                    onPasswordChanged={() => setNeedsPasswordChange(false)}
                    token={token}
                    canGenerateKeys={canGenerateKeys}
                    setCanGenerateKeys={setCanGenerateKeys}
                  />
                )}


                {role === "insurer" && renderClientDetailsForInsurer()}
              </div>
            )
          }
        />
        <Route path="/add-vehicle/:ownerID" element={<AddVehicle token={token} />} />
        <Route path="/owner/:ownerID" element={<OwnerDetails token={token} logout={logout} />} />
        <Route path="/home" element={<Home token={token} ownerID={formData.ownerID} logout={logout} />} />
        <Route path="/vehicle/:vehicleID" element={<VehicleTrips token={token} logout={logout} ownerID={formData.ownerID} role={role} />} />
        <Route path="/simulate" element={<CarSimulation token={token} ownerID={formData.ownerID} />} />
        <Route path="/create-criteria-weight" element={<CreateCriteriaWeight token={token} />} />
        <Route path="/addInsuranceContract/:ownerID/:vehicleID" element={<AddInsuranceContract token={token} />} />
      </Routes>
    </div>
  );
};

export default App;
