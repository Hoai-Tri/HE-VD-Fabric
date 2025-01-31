import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import JSBI from 'jsbi';

const API_URL = 'http://localhost:3001/api';

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

const AddVehicle = ({ token }) => {
  const { ownerID } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    vehicleID: '',
    vehicle_type: '',
    purchase_mileage: '',
    year: '',
  });
  const [publicKey, setPublicKey] = useState(null);

  useEffect(() => {
    const fetchPublicKey = async () => {
      try {
        const res = await axios.get(`${API_URL}/queryVerifier/${ownerID}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setPublicKey(res.data.data.n);
      } catch (err) {
        console.error('Failed to fetch public key:', err);
      }
    };
    fetchPublicKey();
  }, [ownerID, token]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!publicKey) {
      alert('Encryption key not available, please try again later.');
      return;
    }

    try {
      const encryptedData = {
        vehicleID: formData.vehicleID,
        vehicle_type: encrypt(formData.vehicle_type, publicKey),
        purchase_mileage: encrypt(formData.purchase_mileage, publicKey),
        year: encrypt(formData.year, publicKey),
        ownerID: ownerID,
      };

      await axios.post(`${API_URL}/addVehicleData`, encryptedData, {
        headers: { Authorization: `Bearer ${token}` },
      });

      alert('Vehicle added successfully');
      navigate('/');
    } catch (error) {
      console.error('Error adding vehicle:', error);
      alert('Failed to add vehicle');
    }
  };

  return (
    <div className="container mt-4">
      <h2>Add Vehicle for {ownerID}</h2>
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label>Vehicle ID</label>
          <input name="vehicleID" className="form-control" onChange={handleChange} required />
        </div>
        <div className="mb-3">
          <label>Vehicle Type</label>
          <input name="vehicle_type" className="form-control" onChange={handleChange} required />
        </div>
        <div className="mb-3">
          <label>Purchase Mileage</label>
          <input name="purchase_mileage" type="number" className="form-control" onChange={handleChange} required />
        </div>
        <div className="mb-3">
          <label>Vehicle Age</label>
          <input name="year" type="number" className="form-control" onChange={handleChange} required />
        </div>
        <button type="submit" className="btn btn-primary">Add Vehicle</button>
      </form>
    </div>
  );
};

export default AddVehicle;
