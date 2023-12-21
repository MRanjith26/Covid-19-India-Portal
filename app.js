const express = require("express");
const app = express();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

app.use(express.json());
let dbPath = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is Starting at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

//Middleware function
const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};
//Login API
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "MY_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//Get All states API
app.get("/states/", authenticateToken, async (request, response) => {
  const getStatesQuery = `SELECT * FROM state;`;
  const statesArray = await db.all(getStatesQuery);
  const getAllStatesInCamel = (eachArray) => {
    return {
      stateId: eachArray.state_id,
      stateName: eachArray.state_name,
      population: eachArray.population,
    };
  };
  response.send(statesArray.map((eachArray) => getAllStatesInCamel(eachArray)));
});

//Get state details based  on states id
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const stateDetailsQuery = `SELECT * FROM state WHERE state_id=${stateId};`;
  const stateDetails = await db.get(stateDetailsQuery);
  const getStateDetails = (state) => {
    return {
      stateId: state.state_id,
      stateName: state.state_name,
      population: state.population,
    };
  };
  response.send(getStateDetails(stateDetails));
});

//create a district
app.post("/districts/", authenticateToken, async (request, response) => {
  const districtBody = request.body;
  const { districtName, stateId, cases, cured, active, deaths } = districtBody;
  const createDistrictQuery = ` 
  INSERT INTO
  district (district_name, state_id, cases, cured, active, deaths)
  VALUES (
      '${districtName}',
      ${stateId},
      ${cases},
      ${cured},
      ${active},
      ${deaths}
  );`;
  await db.run(createDistrictQuery);
  response.send("District Successfully Added");
});

//get district based on district id
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `
  SELECT 
  *
  FROM 
  district
  WHERE
  district_id = ${districtId};`;
    const dbDistrict = await db.get(getDistrictQuery);
    const getDistrictCamel = (district) => {
      return {
        districtId: district.district_id,
        districtName: district.district_name,
        stateId: district.state_id,
        cases: district.cases,
        cured: district.cured,
        active: district.active,
        deaths: district.deaths,
      };
    };
    response.send(getDistrictCamel(dbDistrict));
  }
);

//Delete district based on district id
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `
    DELETE FROM district
    WHERE district_id = ${districtId};`;
    await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

//update district based on district_id
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const updateDistrictBody = request.body;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = updateDistrictBody;
    const updateDistrictQuery = ` 
    UPDATE district 
    SET
    district_name ='${districtName}',
    state_id= ${stateId},
    cases = ${cases},
    cured = ${cured},
    active=${active},
    deaths=${deaths};
    WHERE 
    district_id=${districtId};`;
    await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

//statistics based on state_id
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const statsQuery = `
    SELECT 
        SUM(cases) AS totalCases,
        SUM(cured) AS totalCured,
        SUM(active) AS totalActive,
        SUM(deaths) AS totalDeaths
    FROM 
        district
    WHERE
        state_id = ${stateId};`;
    const stats = await db.get(statsQuery);
    response.send(stats);
  }
);
module.exports = app;
