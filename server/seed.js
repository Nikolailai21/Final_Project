const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const dotenv = require("dotenv");

dotenv.config();

const User = require("./models/User");
const Course = require("./models/Course");
const Offering = require("./models/Offering");
const Record = require("./models/Record");
const Registration = require("./models/Registration");
const CourseRequest = require("./models/CourseRequest");

const runSeed = async () => {
  try {
    const mongoUri =
      process.env.MONGO_URI || "mongodb://127.0.0.1:27017/csc220_db";

    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB for seeding...");

    // 1. Wipe existing data
    await User.deleteMany({});
    await Course.deleteMany({});
    await Offering.deleteMany({});
    await Record.deleteMany({});
    await Registration.deleteMany({});
    await CourseRequest.deleteMany({});
    console.log("Cleared existing collections.");

    const passwordHash = await bcrypt.hash("123", 10);

    // 2. Create Admin Account
    const admin = await User.create({
      name: "System Admin",
      email: "admin@system.com",
      passwordHash,
      role: "admin",
      active: true,
    });

    // 3. Create Advisor Accounts
    const advisors = await User.create([
      {
        name: "WendyLuu",
        email: "wendy@gmail.com",
        passwordHash,
        role: "advisor",
        active: true,
      },
      {
        name: "Zak",
        email: "zak@stamford.edu",
        passwordHash,
        role: "advisor",
        active: true,
      },
    ]);

    const defaultAdvisorId = advisors[0]._id;

    // 4. Create Student Accounts
    const rawStudents = [
      { name: "Ayla", email: "ayla@gmail.com", studentId: "STU1001" },
      { name: "Nikolai", email: "niko@gmail.com", studentId: "STU1002" },
      { name: "Ronaldo", email: "ronaldo@gmail.com", studentId: "STU1003" },
      { name: "Captan", email: "rachaphonb@gmail.com", studentId: "STU1004" },
      { name: "Bobby", email: "bobb@gmail.com", studentId: "STU1005" },
      { name: "Cucumber", email: "cucu@gmail.com", studentId: "STU1006" },
      { name: "Demon", email: "demon@gmail.com", studentId: "STU1007" },
      { name: "Kappaboy", email: "kappy@gmail.com", studentId: "STU1008" },
      { name: "Zane", email: "zane@gmail.com", studentId: "STU1009" },
      { name: "Alex", email: "alex@gmail.com", studentId: "STU1010" },
      { name: "Bay", email: "bay@gmail.com", studentId: "STU1011" },
      { name: "Elysia", email: "abc123@gmail.com", studentId: "STU1012" },
      { name: "Maxim", email: "irf@mail.ru", studentId: "STU1013" },
      { name: "Elara", email: "elara@gmail.com", studentId: "STU1014" },
      { name: "Peter", email: "peter@gmail.com", studentId: "STU1015" },
      {
        name: "Helloworld",
        email: "helloworld@gmail.com",
        studentId: "STU1016",
      },
      { name: "Bernardo", email: "bernardo@gmail.com", studentId: "STU1017" },
      { name: "Zinn", email: "zinn@gmail.com", studentId: "STU1018" },
    ];

    const studentUserMap = {};

    for (let s of rawStudents) {
      const u = await User.create({
        ...s,
        passwordHash,
        role: "student",
        advisorId: defaultAdvisorId,
        active: true,
      });

      studentUserMap[s.email.toLowerCase()] = u._id;
    }

    console.log("Created student accounts.");

    // 5. Create standardized courses (4 credits each)
    const rawCourses = [
      { code: "ITE451", title: "AWS Cloud Foundations", credits: 4 },
      {
        code: "SOC221",
        title: "Business Culture and Current Issues in ASEAN",
        credits: 4,
      },
      { code: "MAT101", title: "College Algebra I", credits: 4 },
      { code: "ENG103", title: "College English III", credits: 4 },
      { code: "MIS103", title: "Computer Applications", credits: 4 },
      { code: "ITE104", title: "Computer Organization", credits: 4 },
      {
        code: "ITE441",
        title: "Database Management Systems I",
        credits: 4,
      },
      {
        code: "ITE442",
        title: "Database Management Systems II",
        credits: 4,
      },
      { code: "PSY202", title: "Developmental Psychology", credits: 4 },
      { code: "ITE102", title: "Discrete Mathematics", credits: 4 },
      { code: "THA101", title: "Elementary Thai I", credits: 4 },
      { code: "PSY101", title: "General Psychology", credits: 4 },
      { code: "ITE254", title: "Human-Computer Interaction", credits: 4 },
      {
        code: "ITE420",
        title: "Information Assurance and Security I",
        credits: 4,
      },
      {
        code: "ITE421",
        title: "Information Assurance and Security II",
        credits: 4,
      },
      {
        code: "ITE101",
        title: "Information Technology Fundamentals",
        credits: 4,
      },
      {
        code: "ITE331",
        title: "Introduction to 3D Modeling and Virtual Reality",
        credits: 4,
      },
      {
        code: "ENG101",
        title: "Introduction to Academic Writing",
        credits: 4,
      },
      { code: "ITE224", title: "Introduction to Data Science", credits: 4 },
      { code: "ECO200", title: "Introduction to Economics", credits: 4 },
      {
        code: "ITE233",
        title: "Introduction to Internet of Things",
        credits: 4,
      },
      { code: "STA101", title: "Introduction to Statistics", credits: 4 },
      {
        code: "ITE479",
        title: "IT Planning and Project Management",
        credits: 4,
      },
      {
        code: "ITE201",
        title: "IT Service Desk & Incident Management",
        credits: 4,
      },
      { code: "ITE223", title: "Java Programming II", credits: 4 },
      { code: "ITE353", title: "Machine Learning Foundation", credits: 4 },
      {
        code: "ITE343",
        title: "Mobile Application Development",
        credits: 4,
      },
      { code: "ITE475", title: "Network I", credits: 4 },
      { code: "ITE476", title: "Network II", credits: 4 },
      { code: "ITE240", title: "Operating Systems", credits: 4 },
      { code: "ITE221", title: "Programming I", credits: 4 },
      { code: "ITE222", title: "Programming II", credits: 4 },
      {
        code: "MAT102",
        title: "Quantitative Methods for Business",
        credits: 4,
      },
      {
        code: "ITE210",
        title: "Social and Professional Issues in Information Technology",
        credits: 4,
      },
      {
        code: "ITE478",
        title: "Software Planning and Project Management",
        credits: 4,
      },
      { code: "ITE365", title: "Software Quality Management", credits: 4 },
      {
        code: "ITE368",
        title: "Software Testing and Maintenance",
        credits: 4,
      },
      {
        code: "ITE231",
        title: "System Administration and Maintenance",
        credits: 4,
      },
      {
        code: "ITE321",
        title: "System Analysis, Design and Implementation",
        credits: 4,
      },
      { code: "HIS101", title: "Thai History and Culture", credits: 4 },
      { code: "ITE120", title: "Web Development I", credits: 4 },
      { code: "ITE220", title: "Web Development II", credits: 4 },
      { code: "ITE477", title: "Windows Server", credits: 4 },
      { code: "GEO101", title: "World Geography", credits: 4 },

      // Legacy course retained for historical records
      { code: "ITE443", title: "Data Management", credits: 4 },
    ];

    const courseMap = {};

    for (let c of rawCourses) {
      const crs = await Course.create(c);
      courseMap[c.code] = crs._id;
    }

    console.log(`Created ${rawCourses.length} courses.`);

    // 6. Create Course Offerings for Term 2026-1
    const offerings = await Offering.create([
      {
        courseId: courseMap["ITE220"],
        term: "2026-1",
        section: 1,
        day: "Monday",
        startTime: "09:00",
        endTime: "12:00",
        room: "Lab 1",
        instructor: "Ajarn Amin",
        seats: 30,
        seatsTaken: 5,
        addDropOpen: true,
      },
      {
        courseId: courseMap["ITE102"],
        term: "2026-1",
        section: 1,
        day: "Monday",
        startTime: "09:00",
        endTime: "12:00",
        room: "Room 202",
        instructor: "Prof. John",
        seats: 2,
        seatsTaken: 2,
        addDropOpen: false,
      },
      {
        courseId: courseMap["ITE475"],
        term: "2026-1",
        section: 1,
        day: "Wednesday",
        startTime: "13:00",
        endTime: "16:00",
        room: "Lab 3",
        instructor: "Dr. Sarah",
        seats: 25,
        seatsTaken: 10,
        addDropOpen: true,
      },
      {
        courseId: courseMap["ITE240"],
        term: "2026-1",
        section: 1,
        day: "Thursday",
        startTime: "09:00",
        endTime: "12:00",
        room: "Room 305",
        instructor: "Dr. David",
        seats: 30,
        seatsTaken: 8,
        addDropOpen: true,
      },
      {
        courseId: courseMap["ITE343"],
        term: "2026-1",
        section: 1,
        day: "Friday",
        startTime: "13:00",
        endTime: "16:00",
        room: "Lab 4",
        instructor: "Prof. Lisa",
        seats: 20,
        seatsTaken: 4,
        addDropOpen: true,
      },
    ]);

    console.log(`Created $DIL1 offerings for Term 2026-1.`);

    // 7. Historical course records
    const rawRecords = [
      {
        studentEmail: "ayla@gmail.com",
        courseCode: "ENG101",
        term: "Semester 3/2023",
        grade: "B",
      },
      {
        studentEmail: "ayla@gmail.com",
        courseCode: "ITE420",
        term: "Semester 3/2024",
        grade: "A",
      },
      {
        studentEmail: "ayla@gmail.com",
        courseCode: "SOC221",
        term: "Semester 3/2023",
        grade: "W",
      },
      {
        studentEmail: "ayla@gmail.com",
        courseCode: "ITE102",
        term: "Semester 1/2025",
        grade: "D+",
      },
      {
        studentEmail: "ayla@gmail.com",
        courseCode: "ITE224",
        term: "Semester 3/2025",
        grade: "B",
      },
      {
        studentEmail: "ayla@gmail.com",
        courseCode: "ITE368",
        term: "Semester 3/2025",
        grade: "A",
      },
      {
        studentEmail: "ayla@gmail.com",
        courseCode: "THA101",
        term: "Semester 1/2026",
        grade: "IP",
      },
      {
        studentEmail: "ayla@gmail.com",
        courseCode: "ITE231",
        term: "Semester 2/2025",
        grade: "A",
      },
      {
        studentEmail: "ayla@gmail.com",
        courseCode: "ITE220",
        term: "Semester 1/2026",
        grade: "IP",
      },
      {
        studentEmail: "ayla@gmail.com",
        courseCode: "ITE254",
        term: "Semester 1/2025",
        grade: "A",
      },
      {
        studentEmail: "niko@gmail.com",
        courseCode: "ITE441",
        term: "Semester 2/2024",
        grade: "A",
      },
      {
        studentEmail: "niko@gmail.com",
        courseCode: "PSY101",
        term: "Semester 1/2024",
        grade: "B",
      },
      {
        studentEmail: "niko@gmail.com",
        courseCode: "ITE240",
        term: "Semester 3/2023",
        grade: "B+",
      },
      {
        studentEmail: "niko@gmail.com",
        courseCode: "STA101",
        term: "Semester 2/2024",
        grade: "A",
      },
      {
        studentEmail: "niko@gmail.com",
        courseCode: "ITE102",
        term: "Semester 3/2025",
        grade: "C+",
      },
      {
        studentEmail: "niko@gmail.com",
        courseCode: "ITE343",
        term: "Semester 2/2025",
        grade: "A",
      },
      {
        studentEmail: "niko@gmail.com",
        courseCode: "ENG103",
        term: "Semester 1/2024",
        grade: "C",
      },
      {
        studentEmail: "niko@gmail.com",
        courseCode: "ITE475",
        term: "Semester 3/2024",
        grade: "A",
      },
      {
        studentEmail: "niko@gmail.com",
        courseCode: "ITE365",
        term: "Semester 2/2025",
        grade: "A",
      },
      {
        studentEmail: "niko@gmail.com",
        courseCode: "ITE220",
        term: "Semester 1/2026",
        grade: "IP",
      },
      {
        studentEmail: "ronaldo@gmail.com",
        courseCode: "MIS103",
        term: "Semester 2/2024",
        grade: "B",
      },
      {
        studentEmail: "ronaldo@gmail.com",
        courseCode: "ITE254",
        term: "Semester 3/2024",
        grade: "A",
      },
      {
        studentEmail: "ronaldo@gmail.com",
        courseCode: "ITE331",
        term: "Semester 1/2024",
        grade: "A",
      },
      {
        studentEmail: "ronaldo@gmail.com",
        courseCode: "PSY101",
        term: "Semester 1/2024",
        grade: "A",
      },
      {
        studentEmail: "ronaldo@gmail.com",
        courseCode: "MAT101",
        term: "Semester 2/2024",
        grade: "B+",
      },
      {
        studentEmail: "ronaldo@gmail.com",
        courseCode: "ITE479",
        term: "Semester 3/2024",
        grade: "B",
      },
      {
        studentEmail: "ronaldo@gmail.com",
        courseCode: "ITE102",
        term: "Semester 1/2025",
        grade: "D+",
      },
      {
        studentEmail: "ronaldo@gmail.com",
        courseCode: "ITE443",
        term: "Semester 1/2025",
        grade: "A",
      },
      {
        studentEmail: "ronaldo@gmail.com",
        courseCode: "ITE223",
        term: "Semester 2/2025",
        grade: "A",
      },
      {
        studentEmail: "ronaldo@gmail.com",
        courseCode: "ITE240",
        term: "Semester 3/2025",
        grade: "C",
      },
      {
        studentEmail: "rachaphonb@gmail.com",
        courseCode: "ITE104",
        term: "Semester 2/2025",
        grade: "A",
      },
      {
        studentEmail: "rachaphonb@gmail.com",
        courseCode: "ITE479",
        term: "Semester 2/2025",
        grade: "A",
      },
      {
        studentEmail: "rachaphonb@gmail.com",
        courseCode: "MIS103",
        term: "Semester 3/2023",
        grade: "B+",
      },
      {
        studentEmail: "rachaphonb@gmail.com",
        courseCode: "ENG103",
        term: "Semester 3/2024",
        grade: "C",
      },
      {
        studentEmail: "rachaphonb@gmail.com",
        courseCode: "ITE101",
        term: "Semester 1/2024",
        grade: "B+",
      },
      {
        studentEmail: "rachaphonb@gmail.com",
        courseCode: "ITE240",
        term: "Semester 1/2025",
        grade: "C",
      },
      {
        studentEmail: "rachaphonb@gmail.com",
        courseCode: "MAT101",
        term: "Semester 1/2024",
        grade: "C",
      },
      {
        studentEmail: "rachaphonb@gmail.com",
        courseCode: "ITE231",
        term: "Semester 2/2025",
        grade: "A",
      },
      {
        studentEmail: "rachaphonb@gmail.com",
        courseCode: "ENG101",
        term: "Semester 3/2023",
        grade: "B",
      },
      {
        studentEmail: "rachaphonb@gmail.com",
        courseCode: "ITE475",
        term: "Semester 2/2025",
        grade: "A",
      },
      {
        studentEmail: "bobb@gmail.com",
        courseCode: "ENG103",
        term: "Semester 3/2023",
        grade: "B",
      },
      {
        studentEmail: "bobb@gmail.com",
        courseCode: "ITE222",
        term: "Semester 1/2024",
        grade: "A",
      },
      {
        studentEmail: "bobb@gmail.com",
        courseCode: "ITE231",
        term: "Semester 3/2023",
        grade: "A",
      },
      {
        studentEmail: "bobb@gmail.com",
        courseCode: "ITE223",
        term: "Semester 1/2024",
        grade: "B",
      },
      {
        studentEmail: "bobb@gmail.com",
        courseCode: "ITE240",
        term: "Semester 2/2024",
        grade: "B",
      },
      {
        studentEmail: "bobb@gmail.com",
        courseCode: "ITE101",
        term: "Semester 1/2025",
        grade: "B+",
      },
      {
        studentEmail: "bobb@gmail.com",
        courseCode: "ITE102",
        term: "Semester 1/2025",
        grade: "C",
      },
      {
        studentEmail: "bobb@gmail.com",
        courseCode: "ITE443",
        term: "Semester 2/2025",
        grade: "A",
      },
      {
        studentEmail: "bobb@gmail.com",
        courseCode: "ITE368",
        term: "Semester 3/2025",
        grade: "A",
      },
      {
        studentEmail: "bobb@gmail.com",
        courseCode: "ITE220",
        term: "Semester 1/2026",
        grade: "IP",
      },
      {
        studentEmail: "cucu@gmail.com",
        courseCode: "ENG101",
        term: "Semester 2/2023",
        grade: "A",
      },
      {
        studentEmail: "cucu@gmail.com",
        courseCode: "ITE210",
        term: "Semester 1/2024",
        grade: "C",
      },
      {
        studentEmail: "cucu@gmail.com",
        courseCode: "STA101",
        term: "Semester 3/2023",
        grade: "C",
      },
      {
        studentEmail: "cucu@gmail.com",
        courseCode: "PSY101",
        term: "Semester 1/2024",
        grade: "A",
      },
      {
        studentEmail: "cucu@gmail.com",
        courseCode: "ITE120",
        term: "Semester 1/2024",
        grade: "A",
      },
      {
        studentEmail: "cucu@gmail.com",
        courseCode: "ITE231",
        term: "Semester 2/2024",
        grade: "C",
      },
      {
        studentEmail: "cucu@gmail.com",
        courseCode: "HIS101",
        term: "Semester 3/2024",
        grade: "A",
      },
      {
        studentEmail: "cucu@gmail.com",
        courseCode: "GEO101",
        term: "Semester 1/2025",
        grade: "A",
      },
      {
        studentEmail: "cucu@gmail.com",
        courseCode: "ITE240",
        term: "Semester 2/2025",
        grade: "C",
      },
      {
        studentEmail: "cucu@gmail.com",
        courseCode: "ITE220",
        term: "Semester 1/2026",
        grade: "IP",
      },
      {
        studentEmail: "demon@gmail.com",
        courseCode: "ENG101",
        term: "Semester 3/2023",
        grade: "A",
      },
      {
        studentEmail: "demon@gmail.com",
        courseCode: "ITE420",
        term: "Semester 3/2023",
        grade: "A",
      },
      {
        studentEmail: "demon@gmail.com",
        courseCode: "SOC221",
        term: "Semester 1/2024",
        grade: "D+",
      },
      {
        studentEmail: "demon@gmail.com",
        courseCode: "ITE102",
        term: "Semester 2/2024",
        grade: "B",
      },
      {
        studentEmail: "demon@gmail.com",
        courseCode: "ITE224",
        term: "Semester 1/2025",
        grade: "A",
      },
      {
        studentEmail: "demon@gmail.com",
        courseCode: "ITE368",
        term: "Semester 1/2025",
        grade: "A",
      },
      {
        studentEmail: "demon@gmail.com",
        courseCode: "THA101",
        term: "Semester 2/2025",
        grade: "B",
      },
      {
        studentEmail: "demon@gmail.com",
        courseCode: "ITE231",
        term: "Semester 2/2025",
        grade: "B",
      },
      {
        studentEmail: "demon@gmail.com",
        courseCode: "ITE254",
        term: "Semester 3/2025",
        grade: "B+",
      },
      {
        studentEmail: "demon@gmail.com",
        courseCode: "ITE220",
        term: "Semester 1/2026",
        grade: "IP",
      },
      {
        studentEmail: "kappy@gmail.com",
        courseCode: "MAT102",
        term: "Semester 2/2024",
        grade: "A",
      },
      {
        studentEmail: "kappy@gmail.com",
        courseCode: "ENG101",
        term: "Semester 1/2024",
        grade: "D+",
      },
      {
        studentEmail: "kappy@gmail.com",
        courseCode: "PSY101",
        term: "Semester 1/2024",
        grade: "C+",
      },
      {
        studentEmail: "kappy@gmail.com",
        courseCode: "ITE102",
        term: "Semester 3/2024",
        grade: "C",
      },
      {
        studentEmail: "kappy@gmail.com",
        courseCode: "ECO200",
        term: "Semester 3/2024",
        grade: "D+",
      },
      {
        studentEmail: "kappy@gmail.com",
        courseCode: "MIS103",
        term: "Semester 1/2025",
        grade: "A",
      },
      {
        studentEmail: "kappy@gmail.com",
        courseCode: "ITE221",
        term: "Semester 1/2025",
        grade: "A",
      },
      {
        studentEmail: "kappy@gmail.com",
        courseCode: "ITE240",
        term: "Semester 2/2025",
        grade: "D+",
      },
      {
        studentEmail: "kappy@gmail.com",
        courseCode: "ITE220",
        term: "Semester 1/2026",
        grade: "IP",
      },
      {
        studentEmail: "zane@gmail.com",
        courseCode: "ITE479",
        term: "Semester 3/2023",
        grade: "A",
      },
      {
        studentEmail: "zane@gmail.com",
        courseCode: "ITE120",
        term: "Semester 1/2024",
        grade: "A",
      },
      {
        studentEmail: "zane@gmail.com",
        courseCode: "MIS103",
        term: "Semester 2/2024",
        grade: "A",
      },
      {
        studentEmail: "zane@gmail.com",
        courseCode: "PSY101",
        term: "Semester 3/2024",
        grade: "A",
      },
      {
        studentEmail: "zane@gmail.com",
        courseCode: "MAT101",
        term: "Semester 1/2025",
        grade: "B",
      },
      {
        studentEmail: "zane@gmail.com",
        courseCode: "ITE220",
        term: "Semester 2/2025",
        grade: "A",
      },
      {
        studentEmail: "zane@gmail.com",
        courseCode: "ITE102",
        term: "Semester 3/2025",
        grade: "D+",
      },
      {
        studentEmail: "zane@gmail.com",
        courseCode: "ITE441",
        term: "Semester 3/2025",
        grade: "A",
      },
      {
        studentEmail: "zane@gmail.com",
        courseCode: "ITE223",
        term: "Semester 1/2026",
        grade: "A",
      },
      {
        studentEmail: "zane@gmail.com",
        courseCode: "ITE240",
        term: "Semester 1/2026",
        grade: "C",
      },
      {
        studentEmail: "alex@gmail.com",
        courseCode: "ITE101",
        term: "Semester 3/2025",
        grade: "A",
      },
      {
        studentEmail: "alex@gmail.com",
        courseCode: "ITE451",
        term: "Semester 1/2025",
        grade: "A",
      },
      {
        studentEmail: "alex@gmail.com",
        courseCode: "ITE443",
        term: "Semester 2/2025",
        grade: "A",
      },
      {
        studentEmail: "alex@gmail.com",
        courseCode: "ITE102",
        term: "Semester 2/2025",
        grade: "D+",
      },
      {
        studentEmail: "alex@gmail.com",
        courseCode: "ITE353",
        term: "Semester 3/2025",
        grade: "A",
      },
      {
        studentEmail: "alex@gmail.com",
        courseCode: "ITE368",
        term: "Semester 3/2025",
        grade: "A",
      },
      {
        studentEmail: "alex@gmail.com",
        courseCode: "ITE220",
        term: "Semester 1/2026",
        grade: "IP",
      },
      {
        studentEmail: "bay@gmail.com",
        courseCode: "ITE201",
        term: "Semester 2/2023",
        grade: "B",
      },
      {
        studentEmail: "bay@gmail.com",
        courseCode: "ITE451",
        term: "Semester 2/2023",
        grade: "B+",
      },
      {
        studentEmail: "bay@gmail.com",
        courseCode: "ITE477",
        term: "Semester 3/2023",
        grade: "A",
      },
      {
        studentEmail: "bay@gmail.com",
        courseCode: "ITE231",
        term: "Semester 1/2024",
        grade: "B+",
      },
      {
        studentEmail: "bay@gmail.com",
        courseCode: "ITE233",
        term: "Semester 2/2024",
        grade: "A",
      },
      {
        studentEmail: "bay@gmail.com",
        courseCode: "ITE421",
        term: "Semester 3/2024",
        grade: "B",
      },
      {
        studentEmail: "bay@gmail.com",
        courseCode: "ITE476",
        term: "Semester 1/2025",
        grade: "A",
      },
      {
        studentEmail: "bay@gmail.com",
        courseCode: "ITE442",
        term: "Semester 2/2025",
        grade: "A",
      },
      {
        studentEmail: "bay@gmail.com",
        courseCode: "ITE353",
        term: "Semester 3/2025",
        grade: "A",
      },
      {
        studentEmail: "bay@gmail.com",
        courseCode: "ITE220",
        term: "Semester 1/2026",
        grade: "IP",
      },
      {
        studentEmail: "abc123@gmail.com",
        courseCode: "MIS103",
        term: "Semester 3/2024",
        grade: "A",
      },
      {
        studentEmail: "abc123@gmail.com",
        courseCode: "ENG101",
        term: "Semester 1/2024",
        grade: "A",
      },
      {
        studentEmail: "abc123@gmail.com",
        courseCode: "PSY101",
        term: "Semester 1/2024",
        grade: "A",
      },
      {
        studentEmail: "abc123@gmail.com",
        courseCode: "ITE102",
        term: "Semester 2/2024",
        grade: "A",
      },
      {
        studentEmail: "abc123@gmail.com",
        courseCode: "MAT101",
        term: "Semester 3/2024",
        grade: "A",
      },
      {
        studentEmail: "abc123@gmail.com",
        courseCode: "ITE120",
        term: "Semester 1/2025",
        grade: "A",
      },
      {
        studentEmail: "abc123@gmail.com",
        courseCode: "ITE220",
        term: "Semester 2/2025",
        grade: "A",
      },
      {
        studentEmail: "abc123@gmail.com",
        courseCode: "ITE220",
        term: "Semester 1/2026",
        grade: "IP",
      },
      {
        studentEmail: "irf@mail.ru",
        courseCode: "ITE476",
        term: "Semester 3/2025",
        grade: "B",
      },
      {
        studentEmail: "irf@mail.ru",
        courseCode: "ITE233",
        term: "Semester 1/2025",
        grade: "A",
      },
      {
        studentEmail: "irf@mail.ru",
        courseCode: "ITE477",
        term: "Semester 2/2025",
        grade: "C+",
      },
      {
        studentEmail: "irf@mail.ru",
        courseCode: "ITE231",
        term: "Semester 2/2025",
        grade: "C+",
      },
      {
        studentEmail: "irf@mail.ru",
        courseCode: "ITE421",
        term: "Semester 3/2025",
        grade: "A",
      },
      {
        studentEmail: "irf@mail.ru",
        courseCode: "ITE451",
        term: "Semester 3/2025",
        grade: "A",
      },
      {
        studentEmail: "irf@mail.ru",
        courseCode: "ITE220",
        term: "Semester 1/2026",
        grade: "IP",
      },
      {
        studentEmail: "elara@gmail.com",
        courseCode: "ITE441",
        term: "Semester 2/2024",
        grade: "A",
      },
      {
        studentEmail: "elara@gmail.com",
        courseCode: "ENG101",
        term: "Semester 1/2024",
        grade: "B",
      },
      {
        studentEmail: "elara@gmail.com",
        courseCode: "PSY101",
        term: "Semester 3/2023",
        grade: "B",
      },
      {
        studentEmail: "elara@gmail.com",
        courseCode: "STA101",
        term: "Semester 2/2024",
        grade: "B",
      },
      {
        studentEmail: "elara@gmail.com",
        courseCode: "ITE102",
        term: "Semester 3/2024",
        grade: "C+",
      },
      {
        studentEmail: "elara@gmail.com",
        courseCode: "ITE343",
        term: "Semester 1/2025",
        grade: "A",
      },
      {
        studentEmail: "elara@gmail.com",
        courseCode: "ENG103",
        term: "Semester 2/2025",
        grade: "B",
      },
      {
        studentEmail: "elara@gmail.com",
        courseCode: "ITE475",
        term: "Semester 2/2025",
        grade: "A",
      },
      {
        studentEmail: "elara@gmail.com",
        courseCode: "ITE365",
        term: "Semester 3/2025",
        grade: "A",
      },
      {
        studentEmail: "elara@gmail.com",
        courseCode: "ITE220",
        term: "Semester 1/2026",
        grade: "IP",
      },
      {
        studentEmail: "peter@gmail.com",
        courseCode: "ENG103",
        term: "Semester 2/2024",
        grade: "A",
      },
      {
        studentEmail: "peter@gmail.com",
        courseCode: "ITE120",
        term: "Semester 3/2024",
        grade: "A",
      },
      {
        studentEmail: "peter@gmail.com",
        courseCode: "MIS103",
        term: "Semester 1/2024",
        grade: "B",
      },
      {
        studentEmail: "peter@gmail.com",
        courseCode: "PSY101",
        term: "Semester 2/2024",
        grade: "A",
      },
      {
        studentEmail: "peter@gmail.com",
        courseCode: "MAT101",
        term: "Semester 3/2024",
        grade: "C",
      },
      {
        studentEmail: "peter@gmail.com",
        courseCode: "ITE220",
        term: "Semester 1/2025",
        grade: "B+",
      },
      {
        studentEmail: "peter@gmail.com",
        courseCode: "ITE102",
        term: "Semester 2/2025",
        grade: "D+",
      },
      {
        studentEmail: "peter@gmail.com",
        courseCode: "ITE441",
        term: "Semester 3/2025",
        grade: "A",
      },
      {
        studentEmail: "peter@gmail.com",
        courseCode: "ITE223",
        term: "Semester 3/2025",
        grade: "A",
      },
      {
        studentEmail: "peter@gmail.com",
        courseCode: "ITE240",
        term: "Semester 1/2026",
        grade: "C",
      },
      {
        studentEmail: "helloworld@gmail.com",
        courseCode: "ITE120",
        term: "Semester 1/2024",
        grade: "A",
      },
      {
        studentEmail: "bernardo@gmail.com",
        courseCode: "ITE220",
        term: "Semester 2/2025",
        grade: "A",
      },
      {
        studentEmail: "bernardo@gmail.com",
        courseCode: "ENG103",
        term: "Semester 3/2024",
        grade: "A",
      },
      {
        studentEmail: "bernardo@gmail.com",
        courseCode: "MIS103",
        term: "Semester 1/2024",
        grade: "B",
      },
      {
        studentEmail: "bernardo@gmail.com",
        courseCode: "PSY101",
        term: "Semester 2/2024",
        grade: "A",
      },
      {
        studentEmail: "bernardo@gmail.com",
        courseCode: "MAT101",
        term: "Semester 3/2024",
        grade: "C",
      },
      {
        studentEmail: "bernardo@gmail.com",
        courseCode: "ITE120",
        term: "Semester 1/2025",
        grade: "B+",
      },
      {
        studentEmail: "bernardo@gmail.com",
        courseCode: "ITE102",
        term: "Semester 2/2025",
        grade: "D+",
      },
      {
        studentEmail: "bernardo@gmail.com",
        courseCode: "ITE441",
        term: "Semester 3/2025",
        grade: "A",
      },
      {
        studentEmail: "bernardo@gmail.com",
        courseCode: "ITE223",
        term: "Semester 3/2025",
        grade: "A",
      },
      {
        studentEmail: "bernardo@gmail.com",
        courseCode: "ITE240",
        term: "Semester 1/2026",
        grade: "C",
      },
      {
        studentEmail: "zinn@gmail.com",
        courseCode: "ITE475",
        term: "Semester 3/2024",
        grade: "A",
      },
      {
        studentEmail: "zinn@gmail.com",
        courseCode: "ITE220",
        term: "Semester 2/2025",
        grade: "B",
      },
      {
        studentEmail: "zinn@gmail.com",
        courseCode: "MIS103",
        term: "Semester 1/2024",
        grade: "A",
      },
      {
        studentEmail: "zinn@gmail.com",
        courseCode: "PSY101",
        term: "Semester 2/2024",
        grade: "A",
      },
      {
        studentEmail: "zinn@gmail.com",
        courseCode: "MAT101",
        term: "Semester 3/2024",
        grade: "B",
      },
      {
        studentEmail: "zinn@gmail.com",
        courseCode: "ITE120",
        term: "Semester 1/2025",
        grade: "A font",
      },
      {
        studentEmail: "zinn@gmail.com",
        courseCode: "ITE102",
        term: "Semester 2/2025",
        grade: "F",
      },
      {
        studentEmail: "zinn@gmail.com",
        courseCode: "ITE441",
        term: "Semester 3/2025",
        grade: "A",
      },
      {
        studentEmail: "zinn@gmail.com",
        courseCode: "ITE223",
        term: "Semester 3/2025",
        grade: "A",
      },
      {
        studentEmail: "zinn@gmail.com",
        courseCode: "ITE240",
        term: "Semester 1/2026",
        grade: "B",
      },
    ];
    let insertedRecordsCount = 0;
    for (let r of rawRecords) {
      const studentObjId = studentUserMap[r.studentEmail.toLowerCase()];
      const courseObjId = courseMap[r.courseCode];
      if (studentObjId && courseObjId) {
        let cleanGrade = r.grade.trim().toUpperCase();
        if (cleanGrade.includes("FONT") || cleanGrade === "A FONT") {
          cleanGrade = "A";
        }
        await Record.create({
          studentId: studentObjId,
          courseId: courseObjId,
          term: r.term,
          grade: cleanGrade,
        });
        insertedRecordsCount++;
      }
    }
    console.log(
      `Successfully seeded ${insertedRecordsCount} completed course records linked via MongoDB ObjectIds.`,
    );
    console.log("\n======================================================");
    console.log(" SEED COMPLETE — READY FOR DEMO & TESTING");
    console.log("======================================================");
    console.log(" Test Admin Account:   admin@system.com / 123");
    console.log(" Test Advisor Account: wendy@gmail.com / 123");
    console.log(" Test Student Account: niko@gmail.com / 123");
    console.log("======================================================\n");
    process.exit(0);
  } catch (err) {
    console.error("Seed execution failed:", err);
    process.exit(1);
  }
};
runSeed();
