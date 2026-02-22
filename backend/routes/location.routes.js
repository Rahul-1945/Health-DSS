const express = require('express');
const router = express.Router();
const axios = require('axios');

router.get('/reverse', async (req, res) => {
  try {
    const { lat, lon } = req.query;

    const response = await axios.get(
      `https://nominatim.openstreetmap.org/reverse`,
      {
        params: {
          format: 'json',
          lat,
          lon,
          addressdetails: 1,
        },
        headers: {
          'User-Agent': 'HealthDSS-App'
        }
      }
    );

    const address = response.data.address;

    const fullAddress = `
${address.road || ""} ${address.house_number || ""},
${address.suburb || address.neighbourhood || ""},
${address.city || address.town || address.village || ""},
${address.state || ""} - ${address.postcode || ""},
${address.country || ""}
    `.trim();

    res.json({
      success: true,
      fullAddress,
      latitude: lat,
      longitude: lon
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;