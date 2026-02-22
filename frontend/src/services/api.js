import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  register:        (data) => api.post('/auth/register', data),
  login:           (data) => api.post('/auth/login', data),
  getMe:           ()     => api.get('/auth/me'),
  getDoctors:      ()     => api.get('/auth/doctors'),
  getTestingCenters: ()   => api.get('/auth/testing-centers'),
};

export const patientAPI = {
  create:   (data)     => api.post('/patients', data),
  getAll:   (params)   => api.get('/patients', { params }),
  getById:  (id)       => api.get(`/patients/${id}`),
  update:   (id, data) => api.put(`/patients/${id}`, data),
  reassess: (id)       => api.post(`/patients/${id}/reassess`),
};

export const consultationAPI = {
  create:       (data)     => api.post('/consultations', data),
  getAll:       (params)   => api.get('/consultations', { params }),
  getById:      (id)       => api.get(`/consultations/${id}`),
  addMessage:   (id, data) => api.post(`/consultations/${id}/messages`, data),
  updateStatus: (id, data) => api.patch(`/consultations/${id}/status`, data),
};

export const predictAPI = {
  getSymptoms:      ()                        => api.get('/predict/symptoms'),
  predict:          (symptoms)                => api.post('/predict', { symptoms }),
  domainRisk:       (domain, inputs, symptoms)=> api.post('/predict/domain-risk', { domain, inputs, symptoms }),
  getDomainFields:  (domain)                  => api.get(`/predict/domain-fields/${domain}`),
  healthCheck:      ()                        => api.get('/predict/health'),
  runDomainModel:   (category, inputs, symptoms) => api.post('/predict/run-domain-model', { category, inputs, symptoms }),
  getCategoryFields:(category)                => api.get(`/predict/category-fields/${category}`),
};

export const testOrderAPI = {
  create:         (data)     => api.post('/test-orders', data),
  getAll:         (params)   => api.get('/test-orders', { params }),
  getById:        (id)       => api.get(`/test-orders/${id}`),
  updateStatus:   (id, data) => api.patch(`/test-orders/${id}/status`, data),
  submitResults:  (id, data) => api.post(`/test-orders/${id}/results`, data),
  setDecision:    (id, data) => api.post(`/test-orders/${id}/decision`, data),
};

export default api;
