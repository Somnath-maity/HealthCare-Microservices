const axios = require("axios");

const GATEWAY = process.env.GATEWAY_URL || "http://api-gateway:3000/api";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const users = [
  {
    email: "admin@healthcare.com",
    password: "Admin@123",
    firstName: "System",
    lastName: "Admin",
    role: "admin",
    phone: "+1-555-0100",
  },
  {
    email: "dr.smith@healthcare.com",
    password: "Doctor@123",
    firstName: "John",
    lastName: "Smith",
    role: "doctor",
    specialization: "General Medicine",
    licenseNumber: "MD-2024-001",
    phone: "+1-555-0101",
  },
  {
    email: "dr.johnson@healthcare.com",
    password: "Doctor@123",
    firstName: "Sarah",
    lastName: "Johnson",
    role: "doctor",
    specialization: "Cardiology",
    licenseNumber: "MD-2024-002",
    phone: "+1-555-0102",
  },
  {
    email: "dr.patel@healthcare.com",
    password: "Doctor@123",
    firstName: "Raj",
    lastName: "Patel",
    role: "doctor",
    specialization: "Pediatrics",
    licenseNumber: "MD-2024-003",
    phone: "+1-555-0103",
  },
  {
    email: "dr.chen@healthcare.com",
    password: "Doctor@123",
    firstName: "Wei",
    lastName: "Chen",
    role: "doctor",
    specialization: "Orthopedics",
    licenseNumber: "MD-2024-004",
    phone: "+1-555-0104",
  },
  {
    email: "nurse.williams@healthcare.com",
    password: "Nurse@123",
    firstName: "Emily",
    lastName: "Williams",
    role: "nurse",
    phone: "+1-555-0110",
  },
  {
    email: "nurse.davis@healthcare.com",
    password: "Nurse@123",
    firstName: "Michael",
    lastName: "Davis",
    role: "nurse",
    phone: "+1-555-0111",
  },
  {
    email: "reception@healthcare.com",
    password: "Reception@123",
    firstName: "Lisa",
    lastName: "Brown",
    role: "receptionist",
    phone: "+1-555-0120",
  },
  {
    email: "patient.doe@email.com",
    password: "Patient@123",
    firstName: "Jane",
    lastName: "Doe",
    role: "patient",
    phone: "+1-555-0200",
  },
  {
    email: "patient.wilson@email.com",
    password: "Patient@123",
    firstName: "Robert",
    lastName: "Wilson",
    role: "patient",
    phone: "+1-555-0201",
  },
];

const patients = [
  {
    firstName: "Jane",
    lastName: "Doe",
    dateOfBirth: "1985-03-15",
    gender: "female",
    email: "patient.doe@email.com",
    phone: "+1-555-0200",
    address: {
      street: "123 Main Street",
      city: "Springfield",
      state: "IL",
      zipCode: "62701",
      country: "USA",
    },
    emergencyContact: {
      name: "John Doe",
      relationship: "Spouse",
      phone: "+1-555-0250",
    },
    insuranceInfo: {
      provider: "Blue Cross",
      policyNumber: "BC-2024-78901",
      groupNumber: "GRP-500",
      expirationDate: "2025-12-31",
    },
    bloodType: "A+",
    allergies: ["Penicillin", "Peanuts"],
    chronicConditions: ["Asthma"],
  },
  {
    firstName: "Robert",
    lastName: "Wilson",
    dateOfBirth: "1972-08-22",
    gender: "male",
    email: "patient.wilson@email.com",
    phone: "+1-555-0201",
    address: {
      street: "456 Oak Avenue",
      city: "Springfield",
      state: "IL",
      zipCode: "62702",
      country: "USA",
    },
    emergencyContact: {
      name: "Mary Wilson",
      relationship: "Wife",
      phone: "+1-555-0251",
    },
    insuranceInfo: {
      provider: "Aetna",
      policyNumber: "AE-2024-45678",
      groupNumber: "GRP-300",
      expirationDate: "2025-06-30",
    },
    bloodType: "O+",
    allergies: ["Sulfa drugs"],
    chronicConditions: ["Hypertension", "Type 2 Diabetes"],
  },
  {
    firstName: "Maria",
    lastName: "Garcia",
    dateOfBirth: "1990-11-05",
    gender: "female",
    email: "maria.garcia@email.com",
    phone: "+1-555-0202",
    address: {
      street: "789 Elm Street",
      city: "Springfield",
      state: "IL",
      zipCode: "62703",
      country: "USA",
    },
    emergencyContact: {
      name: "Carlos Garcia",
      relationship: "Brother",
      phone: "+1-555-0252",
    },
    insuranceInfo: {
      provider: "United Health",
      policyNumber: "UH-2024-12345",
      groupNumber: "GRP-200",
      expirationDate: "2025-09-30",
    },
    bloodType: "B+",
    allergies: [],
    chronicConditions: [],
  },
  {
    firstName: "James",
    lastName: "Anderson",
    dateOfBirth: "1965-01-30",
    gender: "male",
    email: "james.anderson@email.com",
    phone: "+1-555-0203",
    address: {
      street: "321 Pine Road",
      city: "Springfield",
      state: "IL",
      zipCode: "62704",
      country: "USA",
    },
    emergencyContact: {
      name: "Patricia Anderson",
      relationship: "Wife",
      phone: "+1-555-0253",
    },
    insuranceInfo: {
      provider: "Cigna",
      policyNumber: "CG-2024-67890",
      groupNumber: "GRP-400",
      expirationDate: "2025-03-31",
    },
    bloodType: "AB-",
    allergies: ["Ibuprofen", "Latex"],
    chronicConditions: ["Arthritis", "High Cholesterol"],
  },
  {
    firstName: "Aisha",
    lastName: "Mohammed",
    dateOfBirth: "1998-06-12",
    gender: "female",
    email: "aisha.mohammed@email.com",
    phone: "+1-555-0204",
    address: {
      street: "654 Maple Drive",
      city: "Springfield",
      state: "IL",
      zipCode: "62705",
      country: "USA",
    },
    emergencyContact: {
      name: "Fatima Mohammed",
      relationship: "Mother",
      phone: "+1-555-0254",
    },
    insuranceInfo: {
      provider: "Humana",
      policyNumber: "HM-2024-11111",
      groupNumber: "GRP-100",
      expirationDate: "2025-08-31",
    },
    bloodType: "O-",
    allergies: ["Aspirin"],
    chronicConditions: [],
  },
];

async function waitForServices() {
  console.log("Waiting for services to be ready...");
  const maxRetries = 30;
  for (let i = 0; i < maxRetries; i++) {
    try {
      await axios.get(`${GATEWAY}/auth/health`.replace("/api/auth", "").replace("/api", "").replace("//", "/") || `http://api-gateway:3000/health`);
      console.log("Gateway is ready!");
      return;
    } catch {
      console.log(`Attempt ${i + 1}/${maxRetries} - Services not ready yet...`);
      await delay(3000);
    }
  }
  throw new Error("Services did not become ready in time");
}

async function seed() {
  try {
    await waitForServices();
    await delay(2000);

    console.log("\n=== Registering Users ===");
    const registeredUsers = {};
    for (const user of users) {
      try {
        const res = await axios.post(`${GATEWAY}/auth/register`, user);
        registeredUsers[user.email] = {
          ...res.data,
          password: user.password,
        };
        console.log(`  Registered: ${user.firstName} ${user.lastName} (${user.role})`);
      } catch (err) {
        console.log(`  Skipped ${user.email}: ${err.response?.data?.error || err.message}`);
      }
      await delay(200);
    }

    const doctorToken =
      registeredUsers["dr.smith@healthcare.com"]?.accessToken;
    if (!doctorToken) {
      console.log("Logging in as Dr. Smith...");
      const loginRes = await axios.post(`${GATEWAY}/auth/login`, {
        email: "dr.smith@healthcare.com",
        password: "Doctor@123",
      });
      registeredUsers["dr.smith@healthcare.com"] = loginRes.data;
    }

    const authHeader = {
      headers: {
        Authorization: `Bearer ${registeredUsers["dr.smith@healthcare.com"].accessToken}`,
      },
    };

    console.log("\n=== Creating Patients ===");
    const createdPatients = [];
    for (const patient of patients) {
      try {
        const res = await axios.post(
          `${GATEWAY}/patients`,
          patient,
          authHeader
        );
        createdPatients.push(res.data.patient || res.data);
        console.log(`  Created patient: ${patient.firstName} ${patient.lastName}`);
      } catch (err) {
        console.log(`  Skipped ${patient.firstName}: ${err.response?.data?.error || err.message}`);
      }
      await delay(200);
    }

    if (createdPatients.length === 0) {
      console.log("No patients created, skipping appointments and prescriptions.");
      console.log("\n=== Seed Complete ===");
      return;
    }

    console.log("\n=== Creating Appointments ===");
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    const doctors = [
      { email: "dr.smith@healthcare.com", name: "Dr. John Smith" },
      { email: "dr.johnson@healthcare.com", name: "Dr. Sarah Johnson" },
      { email: "dr.patel@healthcare.com", name: "Dr. Raj Patel" },
      { email: "dr.chen@healthcare.com", name: "Dr. Wei Chen" },
    ];

    const appointmentData = [
      {
        patientIndex: 0,
        doctorIndex: 0,
        daysFromNow: 1,
        hour: 9,
        type: "general_checkup",
        reason: "Annual physical examination",
      },
      {
        patientIndex: 1,
        doctorIndex: 1,
        daysFromNow: 1,
        hour: 10,
        type: "follow_up",
        reason: "Blood pressure follow-up",
      },
      {
        patientIndex: 2,
        doctorIndex: 2,
        daysFromNow: 2,
        hour: 11,
        type: "specialist",
        reason: "Pediatric consultation for vaccination schedule",
      },
      {
        patientIndex: 3,
        doctorIndex: 3,
        daysFromNow: 2,
        hour: 14,
        type: "specialist",
        reason: "Knee pain evaluation",
      },
      {
        patientIndex: 4,
        doctorIndex: 0,
        daysFromNow: 3,
        hour: 9,
        type: "general_checkup",
        reason: "New patient intake",
      },
      {
        patientIndex: 0,
        doctorIndex: 1,
        daysFromNow: 5,
        hour: 15,
        type: "lab_work",
        reason: "Routine blood work",
      },
      {
        patientIndex: 1,
        doctorIndex: 0,
        daysFromNow: 7,
        hour: 10,
        type: "follow_up",
        reason: "Diabetes management review",
      },
      {
        patientIndex: 3,
        doctorIndex: 3,
        daysFromNow: 10,
        hour: 11,
        type: "imaging",
        reason: "X-ray for knee evaluation",
      },
    ];

    const createdAppointments = [];
    for (const appt of appointmentData) {
      try {
        const patient = createdPatients[appt.patientIndex];
        if (!patient) continue;

        const doctor = doctors[appt.doctorIndex];
        const doctorUser = registeredUsers[doctor.email];
        let doctorId = doctorUser?.user?._id || doctorUser?.user?.id || "unknown";

        const dateTime = new Date();
        dateTime.setDate(dateTime.getDate() + appt.daysFromNow);
        dateTime.setHours(appt.hour, 0, 0, 0);

        const endTime = new Date(dateTime);
        endTime.setMinutes(endTime.getMinutes() + 30);

        const res = await axios.post(
          `${GATEWAY}/appointments`,
          {
            patientId: patient._id || patient.id,
            doctorId,
            doctorName: doctor.name,
            dateTime: dateTime.toISOString(),
            endTime: endTime.toISOString(),
            type: appt.type,
            reason: appt.reason,
          },
          authHeader
        );
        createdAppointments.push(res.data.appointment || res.data);
        console.log(`  Created appointment: ${patient.firstName} with ${doctor.name} - ${appt.type}`);
      } catch (err) {
        console.log(`  Skipped appointment: ${err.response?.data?.error || err.message}`);
      }
      await delay(200);
    }

    console.log("\n=== Creating Prescriptions ===");
    const prescriptionData = [
      {
        patientIndex: 0,
        medications: [
          {
            name: "Albuterol Inhaler",
            dosage: "90mcg",
            frequency: "as_needed",
            duration: "6 months",
            route: "inhalation",
            instructions: "2 puffs as needed for shortness of breath",
            quantity: 1,
          },
        ],
        diagnosis: "Asthma - mild persistent",
        notes: "Use before exercise. Follow up in 3 months.",
        refillsAllowed: 3,
      },
      {
        patientIndex: 1,
        medications: [
          {
            name: "Lisinopril",
            dosage: "10mg",
            frequency: "once_daily",
            duration: "30 days",
            route: "oral",
            instructions: "Take once daily in the morning",
            quantity: 30,
          },
          {
            name: "Metformin",
            dosage: "500mg",
            frequency: "twice_daily",
            duration: "30 days",
            route: "oral",
            instructions: "Take with meals",
            quantity: 60,
          },
        ],
        diagnosis: "Hypertension and Type 2 Diabetes",
        notes: "Monitor blood pressure daily. Blood sugar check before meals.",
        refillsAllowed: 6,
      },
      {
        patientIndex: 3,
        medications: [
          {
            name: "Ibuprofen",
            dosage: "400mg",
            frequency: "three_times_daily",
            duration: "14 days",
            route: "oral",
            instructions: "Take with food. Do not exceed 3 doses per day.",
            quantity: 42,
          },
        ],
        diagnosis: "Osteoarthritis - right knee",
        notes: "Physical therapy recommended. Avoid high-impact activities.",
        refillsAllowed: 1,
      },
    ];

    for (const rx of prescriptionData) {
      try {
        const patient = createdPatients[rx.patientIndex];
        if (!patient) continue;

        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 30);

        const res = await axios.post(
          `${GATEWAY}/prescriptions`,
          {
            patientId: patient._id || patient.id,
            medications: rx.medications,
            diagnosis: rx.diagnosis,
            notes: rx.notes,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            refillsAllowed: rx.refillsAllowed,
            pharmacy: {
              name: "Springfield Pharmacy",
              address: "100 Health Blvd, Springfield, IL 62701",
              phone: "+1-555-0300",
            },
          },
          authHeader
        );
        console.log(`  Created prescription for ${patient.firstName}: ${rx.diagnosis}`);
      } catch (err) {
        console.log(`  Skipped prescription: ${err.response?.data?.error || err.message}`);
      }
      await delay(200);
    }

    console.log("\n=== Adding Medical Records ===");
    for (let i = 0; i < Math.min(3, createdPatients.length); i++) {
      try {
        const patient = createdPatients[i];
        await axios.post(
          `${GATEWAY}/patients/${patient._id || patient.id}/medical-records`,
          {
            type: "consultation",
            title: "Initial Consultation",
            description: `Initial consultation and health assessment for ${patient.firstName} ${patient.lastName}.`,
            diagnosis: "General health assessment - no acute issues",
            notes: "Patient in overall good health. Recommended routine follow-up.",
            vitals: {
              bloodPressure: "120/80",
              heartRate: 72,
              temperature: 98.6,
              weight: 150 + i * 20,
              height: 165 + i * 5,
              oxygenSaturation: 98,
            },
          },
          authHeader
        );
        console.log(`  Added medical record for ${patient.firstName}`);
      } catch (err) {
        console.log(`  Skipped medical record: ${err.response?.data?.error || err.message}`);
      }
      await delay(200);
    }

    console.log("\n========================================");
    console.log("  SEED COMPLETE!");
    console.log("========================================");
    console.log("\nTest Credentials:");
    console.log("  Admin:        admin@healthcare.com / Admin@123");
    console.log("  Doctor:       dr.smith@healthcare.com / Doctor@123");
    console.log("  Doctor:       dr.johnson@healthcare.com / Doctor@123");
    console.log("  Doctor:       dr.patel@healthcare.com / Doctor@123");
    console.log("  Doctor:       dr.chen@healthcare.com / Doctor@123");
    console.log("  Nurse:        nurse.williams@healthcare.com / Nurse@123");
    console.log("  Receptionist: reception@healthcare.com / Reception@123");
    console.log("  Patient:      patient.doe@email.com / Patient@123");
    console.log("  Patient:      patient.wilson@email.com / Patient@123");
    console.log("\nAPI Gateway:  http://localhost:3000/api");
    console.log("Health Check: http://localhost:3000/health");
    console.log("========================================\n");
  } catch (err) {
    console.error("Seed failed:", err.message);
    process.exit(1);
  }
}

seed();
