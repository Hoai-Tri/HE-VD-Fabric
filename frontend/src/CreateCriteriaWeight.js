import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const CreateCriteriaWeight = ({ token }) => {
  const [formData, setFormData] = useState({
    criteriaWeightsID: '',
    weightTraffic: '',
    weightSpeed: '',
    weightAcceleration: '',
    weightBraking: '',
    weightDistance: '',
    weightZone: '',
    weightTime: '',
    alpha: '',
    beta: '',
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [criteriaWeights, setCriteriaWeights] = useState([]);
  const navigate = useNavigate();

  // Handle input changes
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const response = await axios.post('http://localhost:3001/api/addCriteriaWeight', formData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessage('Criteria added successfully.');
      fetchCriteriaWeights(); // Refresh criteria list
      setTimeout(() => navigate('/'), 2000);
    } catch (error) {
      setMessage('Error adding criteria.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch all criteria weights from the backend
  const fetchCriteriaWeights = async () => {
    try {
      const response = await axios.get('http://localhost:3001/api/queryAllCriteriaWeights', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const response_format = response.data?.data || [];
      setCriteriaWeights(response_format);
    } catch (error) {
      console.error('Error fetching criteria:', error);
      setMessage('Error fetching criteria.');
    }
  };

  useEffect(() => {
    fetchCriteriaWeights();
  }, []);

  return (
    <div className="container mt-4">
      <h2>Create Weighting Criteria</h2>
      {message && <div className="alert alert-info">{message}</div>}
      
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label>Criteria ID</label>
          <input name="criteriaWeightsID" className="form-control" value={formData.criteriaWeightsID} onChange={handleChange} required />
        </div>
        <div className="mb-3">
          <label>Traffic Weight</label>
          <input type="number" name="weightTraffic" className="form-control" value={formData.weightTraffic} onChange={handleChange} required />
        </div>
        <div className="mb-3">
          <label>Speed Weight</label>
          <input type="number" name="weightSpeed" className="form-control" value={formData.weightSpeed} onChange={handleChange} required />
        </div>
        <div className="mb-3">
          <label>Acceleration Weight</label>
          <input type="number" name="weightAcceleration" className="form-control" value={formData.weightAcceleration} onChange={handleChange} required />
        </div>
        <div className="mb-3">
          <label>Braking Weight</label>
          <input type="number" name="weightBraking" className="form-control" value={formData.weightBraking} onChange={handleChange} required />
        </div>
        <div className="mb-3">
          <label>Distance Weight</label>
          <input type="number" name="weightDistance" className="form-control" value={formData.weightDistance} onChange={handleChange} required />
        </div>
        <div className="mb-3">
          <label>Zone Weight</label>
          <input type="number" name="weightZone" className="form-control" value={formData.weightZone} onChange={handleChange} required />
        </div>
        <div className="mb-3">
          <label>Time Weight</label>
          <input type="number" name="weightTime" className="form-control" value={formData.weightTime} onChange={handleChange} required />
        </div>
        <div className="mb-3">
          <label>Alpha</label>
          <input type="number" name="alpha" className="form-control" value={formData.alpha} onChange={handleChange} required />
        </div>
        <div className="mb-3">
          <label>Beta</label>
          <input type="number" name="beta" className="form-control" value={formData.beta} onChange={handleChange} required />
        </div>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Saving...' : 'Add Criteria'}
        </button>
      </form>

      <h2 className="mt-5">Criteria Weight List</h2>
      <table className="table table-striped mt-3">
        <thead>
          <tr>
            <th>ID</th>
            <th>Traffic Compliance</th>
            <th>Speed</th>
            <th>Acceleration</th>
            <th>Braking</th>
            <th>Distance</th>
            <th>Zone</th>
            <th>Night Time</th>
            <th>Alpha</th>
            <th>Beta</th>
          </tr>
        </thead>
        <tbody>
          {criteriaWeights.length > 0 ? (
            criteriaWeights.map((criteria, index) => (
              <tr key={index}>
                <td>{criteria.criteriaweightID}</td>
                <td>{criteria.weight_traffic}</td>
                <td>{criteria.weight_speed}</td>
                <td>{criteria.weight_acceleration}</td>
                <td>{criteria.weight_braking}</td>
                <td>{criteria.weight_distance}</td>
                <td>{criteria.weight_zone}</td>
                <td>{criteria.weight_time}</td>
                <td>{criteria.alpha}</td>
                <td>{criteria.beta}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="10" className="text-center">No criteria found</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};


export default CreateCriteriaWeight;
