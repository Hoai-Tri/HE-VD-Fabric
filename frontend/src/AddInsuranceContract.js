import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_URL = 'http://localhost:3001/api';

const AddInsuranceContract = ({ token }) => {
  const { ownerID, vehicleID } = useParams();
  const navigate = useNavigate();
  const [criteriaOptions, setCriteriaOptions] = useState([]);
  const [formData, setFormData] = useState({
    contractID: '',
    criteriaWeightsID: '',
    startDate: '',
    endDate: '',
  });

  useEffect(() => {
    // Fetch criteria weights IDs from the backend
    const fetchCriteriaWeights = async () => {
      try {
        const response = await axios.get(`${API_URL}/queryAllCriteriaWeights`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        // Ensure the response data is an array
        if (Array.isArray(response.data.data)) {
            setCriteriaOptions(response.data.data);
        } else {
            console.error('Unexpected data format:', response.data.data);
            setCriteriaOptions([]);
        }
        } catch (error) {
            console.error('Error fetching criteria weights:', error);
        }
    };
    fetchCriteriaWeights();
  }, [token]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Extract month and year from selected dates
    const [startYear, startMonth] = formData.startDate.split('-');
    const [endYear, endMonth] = formData.endDate.split('-');

    const contractData = {
      contractID: formData.contractID,
      ownerID,
      vehicleID,
      criteriaWeightsID: formData.criteriaWeightsID,
      startMonth: parseInt(startMonth, 10),
      startYear: parseInt(startYear, 10),
      endMonth: parseInt(endMonth, 10),
      endYear: parseInt(endYear, 10),
    };

    try {
      await axios.post(`${API_URL}/addInsuranceContract`, JSON.stringify(contractData), {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });

      alert('Contract added successfully');
      navigate(`/owner/${ownerID}`);
    } catch (error) {
      console.error('Error adding the contract:', error);
      alert('Failed to add the contract');
    }
  };

  return (
    <div className="container mt-4">
      <h2>Add an Insurance Contract for Vehicle {vehicleID}</h2>
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label>Contract ID</label>
          <input
            name="contractID"
            className="form-control"
            onChange={handleChange}
            required
          />
        </div>

        <div className="mb-3">
          <label>Weighting Criteria ID</label>
          <select
            name="criteriaWeightsID"
            className="form-select"
            onChange={handleChange}
            required
          >
            <option value="">Select a criteria</option>
            {criteriaOptions.map((option) => (
              <option key={option.criteriaweightID} value={option.criteriaweightID}>
                {option.criteriaweightID}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-3">
          <label>Start Date</label>
          <input
            type="month"
            name="startDate"
            className="form-control"
            onChange={handleChange}
            required
          />
        </div>

        <div className="mb-3">
          <label>End Date</label>
          <input
            type="month"
            name="endDate"
            className="form-control"
            onChange={handleChange}
            required
          />
        </div>

        <button type="submit" className="btn btn-primary">Add Contract</button>
      </form>
    </div>
  );
};

export default AddInsuranceContract;
