// MongoDB initialization script for local development
// This script runs automatically when the MongoDB container starts for the first time

// Connect to the database
const db = db.getSiblingDB('nrts-dev')

// Create a test application record for development
const testApplication = {
  _id: ObjectId('69850c237f00b0a3ef284d0c'),
  name: 'Test Crown Land Application',
  status: 'Active',
  agency: 'Ministry of Example',
  client: 'Test Client Corp',
  location: 'British Columbia',
  purpose: 'Land development test application',
  tags: [['public']],
  areaHectares: 150.5,
  createdDate: new Date('2024-01-15'),
  publishDate: new Date('2024-01-20'),
  isDeleted: false,
  centroid: [-120.5, 49.5], // [longitude, latitude] as array of numbers
}

// Check if record already exists before inserting
if (db.applications.findOne({ _id: ObjectId('69850c237f00b0a3ef284d0c') })) {
  print('Test application already exists, skipping insert')
} else {
  db.applications.insertOne(testApplication)
  print('Test application created successfully')
}

print('MongoDB initialization complete')
