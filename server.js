const path = require('path');
const express = require('express');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const app = express();

const dbPath = path.join(__dirname, 'cities.db');

app.use(express.json());

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });

    // Creating cities table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS Cities (
        name TEXT PRIMARY KEY UNIQUE,
        population INTEGER,
        country TEXT,
        latitude REAL,
        longitude REAL
      )
    `);

    app.listen(3000, () => {
      console.log('Server Running at http://localhost:3000/');
    });
  } catch (error) {
    console.error(`DB Error: ${error.message}`);
    process.exit(-1);
  }
};

initializeDBAndServer();

// API FOR ADDING CITY
app.post('/cities', async (request, response) => {
  const { name, population, country, latitude, longitude } = request.body;
  
  if (!name || !population || !country || !latitude || !longitude) {
    return response.status(400).json({ message: 'All fields are required' });
  }

  try {
    const result = await db.run(
      `INSERT INTO Cities (name, population, country, latitude, longitude) 
       VALUES (?, ?, ?, ?, ?)`,
      [name, population, country, latitude, longitude]
    );

    response.status(201).json({
      message: 'City added successfully',
      city: { name, population, country, latitude, longitude }
    });
  } catch (error) {
    response.status(500).json({ message: error.message });
  }
});


// API FOR UPDATING CITY
app.put('/cities/:name', async (request, response) => {
  console.log('Received PUT request');
  const { name } = request.params;
  console.log('City name:', name);
  const { population, country, latitude, longitude } = request.body;

  let updateFields = [];
  let values = [];

  if (population !== undefined) {
    updateFields.push('population = ?');
    values.push(population);
  }
  if (country !== undefined) {
    updateFields.push('country = ?');
    values.push(country);
  }
  if (latitude !== undefined) {
    updateFields.push('latitude = ?');
    values.push(latitude);
  }
  if (longitude !== undefined) {
    updateFields.push('longitude = ?');
    values.push(longitude);
  }

  if (updateFields.length === 0) {
    return response.status(400).json({ message: 'No fields to update' });
  }

  values.push(name);

  const sql = `UPDATE Cities SET ${updateFields.join(', ')} WHERE name = ?`;

  try {
    const result = await db.run(sql, values);
    if (result.changes === 0) {
      return response.status(404).json({ message: 'City not found' });
    }
    response.json({
      message: 'City updated successfully',
    });
  } catch (error) {
    response.status(500).json({ message: error.message });
  }
});



// API FOR DELETIN CITY
app.delete('/cities/:name', async (request, response) => {
  const { name } = request.params;
  try {
    const result = await db.run('DELETE FROM Cities WHERE name = ?', name);
    if (result.changes === 0) {
      return response.status(404).json({ message: 'City not found' });
    }
    response.json({ message: 'City deleted successfully' });
  } catch (error) {
    response.status(500).json({ message: error.message });
  }
});

// API FOR GETTING CITIES
app.get('/cities', async (request, response) => {
  try {
    const { page = 1, limit = 10, sort, search, projection, ...filter } = request.query;

    // projection fields
    const projectionFields = projection
      ? projection.split(',').reduce((fields, field) => {
          fields[field] = 1;
          return fields;
        }, {})
      : {};

    // search criteria
    const searchCriteria = search
      ? `name LIKE '%${search}%'`
      : '';

    // filter criteria
    let filterCriteria = '';
    const filterKeys = Object.keys(filter);
    if (filterKeys.length > 0) {
      filterCriteria = filterKeys.map(key => `${key} = '${filter[key]}'`).join(' AND ');
    }

    // Combining search and filter criteria
    let criteria = searchCriteria;
    if (filterCriteria) {
      criteria = criteria ? `${criteria} AND ${filterCriteria}` : filterCriteria;
    }

    // Fetching cities with pagination, sorting, and projection
    let sql = `SELECT ${Object.keys(projectionFields).length > 0 ? Object.keys(projectionFields).join(', ') : '*'} FROM Cities`;
    if (criteria) {
      sql += ` WHERE ${criteria}`;
    }
    if (sort) {
      sql += ` ORDER BY ${sort}`;
    }
    sql += ` LIMIT ${limit} OFFSET ${(page - 1) * limit}`;

    const cities = await db.all(sql);

    response.json(cities);
  } catch (error) {
    response.status(500).json({ message: error.message });
  }
});

