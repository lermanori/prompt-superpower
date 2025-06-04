const fs = require('fs-extra');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'db');
fs.ensureDirSync(dbPath); // Ensure db directory exists

const getFilePath = (fileName) => path.join(dbPath, `${fileName}.json`);

const readData = async (fileName) => {
  const filePath = getFilePath(fileName);
  try {
    await fs.ensureFile(filePath); // Ensure file exists
    const data = await fs.readFile(filePath, 'utf8');
    return data ? JSON.parse(data) : []; // Return empty array if file is empty
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist, return empty array
      return [];
    } else if (error instanceof SyntaxError) {
      console.error(`Error parsing JSON from ${filePath}:`, error);
      // Handle corrupted JSON file, maybe return empty array or throw
      return []; // Or throw new Error(`Corrupted data file: ${fileName}`);
    } else {
      console.error(`Error reading data from ${filePath}:`, error);
      throw error; // Re-throw other errors
    }
  }
};

const writeData = async (fileName, data) => {
  const filePath = getFilePath(fileName);
  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error(`Error writing data to ${filePath}:`, error);
    throw error;
  }
};

module.exports = { readData, writeData }; 