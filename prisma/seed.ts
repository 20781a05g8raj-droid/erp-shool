import { db } from "../src/lib/db";

// Simple password hashing for demo (in production use bcrypt)
function hashPassword(pwd: string): string {
  // For demo only — storing a simple marker. Real auth compares in API.
  return `demo:${pwd}`;
}

async function main() {
  console.log("Seeding database...");

  // Clean existing data
  await db.certificate.deleteMany();
  await db.schoolEvent.deleteMany();
  await db.notice.deleteMany();
  await db.payroll.deleteMany();
  await db.staffLeave.deleteMany();
  await db.studentTransport.deleteMany();
  await db.vehicle.deleteMany();
  await db.transportRoute.deleteMany();
  await db.bookIssue.deleteMany();
  await db.libraryBook.deleteMany();
  await db.feePayment.deleteMany();
  await db.studentFee.deleteMany();
  await db.feeItem.deleteMany();
  await db.feeStructure.deleteMany();
  await db.homework.deleteMany();
  await db.examResult.deleteMany();
  await db.exam.deleteMany();
  await db.timetableSlot.deleteMany();
  await db.staffAttendance.deleteMany();
  await db.studentAttendance.deleteMany();
  await db.classSubject.deleteMany();
  await db.subject.deleteMany();
  await db.section.deleteMany();
  await db.student.deleteMany();
  await db.class.deleteMany();
  await db.staff.deleteMany();
  await db.profile.deleteMany();
  await db.school.deleteMany();

  // ===== School =====
  const school = await db.school.create({
    data: {
      name: "Greenwood International School",
      address: "123 Education Lane, Knowledge Park, New Delhi - 110001",
      phone: "+91 98765 43210",
      email: "info@greenwood.edu",
      establishedDate: "1998-06-15",
    },
  });

  // ===== Classes =====
  const classData = [
    { name: "Nursery", order: 1 },
    { name: "LKG", order: 2 },
    { name: "UKG", order: 3 },
    { name: "Class 1", order: 4 },
    { name: "Class 2", order: 5 },
    { name: "Class 3", order: 6 },
    { name: "Class 4", order: 7 },
    { name: "Class 5", order: 8 },
    { name: "Class 6", order: 9 },
    { name: "Class 7", order: 10 },
    { name: "Class 8", order: 11 },
    { name: "Class 9", order: 12 },
    { name: "Class 10", order: 13 },
    { name: "Class 11", order: 14 },
    { name: "Class 12", order: 15 },
  ];

  const classes: { id: string; name: string }[] = [];
  for (const c of classData) {
    const cls = await db.class.create({
      data: { ...c, schoolId: school.id },
    });
    classes.push(cls);
  }

  // ===== Sections (A, B for some classes) =====
  const sections: { id: string; name: string; classId: string }[] = [];
  for (const cls of classes) {
    for (const secName of ["A", "B"]) {
      const sec = await db.section.create({
        data: { name: secName, classId: cls.id },
      });
      sections.push(sec);
    }
  }

  // ===== Subjects =====
  const subjectData = [
    { name: "English", code: "ENG" },
    { name: "Mathematics", code: "MATH" },
    { name: "Science", code: "SCI" },
    { name: "Social Studies", code: "SST" },
    { name: "Hindi", code: "HIN" },
    { name: "Computer Science", code: "CS" },
    { name: "Physics", code: "PHY" },
    { name: "Chemistry", code: "CHEM" },
    { name: "Biology", code: "BIO" },
    { name: "Physical Education", code: "PE" },
    { name: "Art", code: "ART" },
    { name: "Music", code: "MUS" },
  ];
  const subjects: { id: string; name: string; code: string }[] = [];
  for (const s of subjectData) {
    const sub = await db.subject.create({
      data: { ...s, schoolId: school.id },
    });
    subjects.push(sub);
  }

  // Assign subjects to classes
  for (const cls of classes) {
    for (const sub of subjects.slice(0, 6)) {
      await db.classSubject.create({
        data: { classId: cls.id, subjectId: sub.id },
      });
    }
  }

  // ===== Staff =====
  const staffData = [
    { firstName: "Rajesh", lastName: "Kumar", designation: "Principal", department: "Administration", type: "non_teaching", salary: 120000 },
    { firstName: "Priya", lastName: "Sharma", designation: "Vice Principal", department: "Administration", type: "non_teaching", salary: 90000 },
    { firstName: "Anita", lastName: "Verma", designation: "Senior Teacher", department: "Mathematics", type: "teaching", salary: 55000 },
    { firstName: "Suresh", lastName: "Patel", designation: "Teacher", department: "Science", type: "teaching", salary: 48000 },
    { firstName: "Meena", lastName: "Reddy", designation: "Teacher", department: "English", type: "teaching", salary: 50000 },
    { firstName: "Vikram", lastName: "Singh", designation: "Teacher", department: "Social Studies", type: "teaching", salary: 47000 },
    { firstName: "Kavita", lastName: "Nair", designation: "Teacher", department: "Hindi", type: "teaching", salary: 45000 },
    { firstName: "Arun", lastName: "Gupta", designation: "Teacher", department: "Computer Science", type: "teaching", salary: 52000 },
    { firstName: "Deepak", lastName: "Mehta", designation: "Accountant", department: "Finance", type: "non_teaching", salary: 40000 },
    { firstName: "Lakshmi", lastName: "Iyer", designation: "Librarian", department: "Library", type: "non_teaching", salary: 38000 },
    { firstName: "Ramesh", lastName: "Yadav", designation: "Transport Manager", department: "Transport", type: "non_teaching", salary: 42000 },
    { firstName: "Sunita", lastName: "Joshi", designation: "HR Manager", department: "Human Resources", type: "non_teaching", salary: 46000 },
  ];

  const staff: { id: string; firstName: string; lastName: string; email: string | null }[] = [];
  for (let i = 0; i < staffData.length; i++) {
    const s = staffData[i];
    const email = `${s.firstName.toLowerCase()}.${s.lastName.toLowerCase()}@greenwood.edu`;
    const st = await db.staff.create({
      data: {
        employeeId: `EMP${String(i + 1).padStart(4, "0")}`,
        firstName: s.firstName,
        lastName: s.lastName,
        email,
        phone: `+91 9${String(800000000 + i * 111111).slice(0, 9)}`,
        dob: `19${75 + i}-0${(i % 9) + 1}-1${i % 9}`,
        gender: i % 2 === 0 ? "male" : "female",
        designation: s.designation,
        department: s.department,
        qualification: s.type === "teaching" ? "M.Ed, B.Ed" : "MBA",
        joiningDate: `20${10 + i}-0${(i % 9) + 1}-15`,
        type: s.type,
        salary: s.salary,
        schoolId: school.id,
      },
    });
    staff.push({ id: st.id, firstName: st.firstName, lastName: st.lastName, email: st.email });
  }

  // Assign class teachers to sections
  const teachers = staff.filter((_, i) => staffData[i].type === "teaching");
  for (let i = 0; i < sections.length && i < teachers.length; i++) {
    await db.section.update({
      where: { id: sections[i].id },
      data: { classTeacherId: teachers[i].id },
    });
  }

  // ===== Students =====
  const firstNames = ["Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Reyansh", "Ayaan", "Krishna", "Ishaan", "Ananya", "Diya", "Saanvi", "Aadhya", "Pari", "Riya", "Myra", "Anika", "Navya", "Kiara", "Reyansh", "Arnav", "Dhruv", "Kabir", "Rohan", "Neha", "Tara", "Zara", "Ira", "Mira"];
  const lastNames = ["Sharma", "Verma", "Gupta", "Singh", "Patel", "Kumar", "Reddy", "Nair", "Joshi", "Mehta", "Yadav", "Iyer", "Rao", "Das", "Bose"];

  const students: { id: string; firstName: string; lastName: string; classId: string | null; sectionId: string | null }[] = [];
  let admissionCounter = 1001;
  for (const cls of classes.slice(3, 13)) {
    const classSections = sections.filter((s) => s.classId === cls.id);
    const studentCount = 8 + Math.floor(Math.random() * 6);
    for (let i = 0; i < studentCount; i++) {
      const fn = firstNames[Math.floor(Math.random() * firstNames.length)];
      const ln = lastNames[Math.floor(Math.random() * lastNames.length)];
      const sec = classSections[i % classSections.length];
      const admNum = `GRW${admissionCounter++}`;
      const student = await db.student.create({
        data: {
          admissionNumber: admNum,
          rollNumber: String(i + 1),
          firstName: fn,
          lastName: ln,
          email: `${fn.toLowerCase()}.${ln.toLowerCase()}@student.greenwood.edu`,
          phone: `+91 8${String(900000000 + admissionCounter * 13).slice(0, 9)}`,
          dob: `20${10 + Math.floor(Math.random() * 8)}-0${(Math.floor(Math.random() * 9) + 1)}-1${Math.floor(Math.random() * 9)}`,
          gender: Math.random() > 0.5 ? "male" : "female",
          bloodGroup: ["A+", "B+", "O+", "AB+", "A-", "O-"][Math.floor(Math.random() * 6)],
          address: `${Math.floor(Math.random() * 200) + 1}, Sector ${Math.floor(Math.random() * 50) + 1}, New Delhi`,
          classId: cls.id,
          sectionId: sec.id,
          status: "active",
          schoolId: school.id,
          fatherName: `Mr. ${ln}`,
          motherName: `Mrs. ${ln}`,
          parentPhone: `+91 9${String(800000000 + admissionCounter * 17).slice(0, 9)}`,
          parentEmail: `parent.${fn.toLowerCase()}@gmail.com`,
          admissionDate: `20${20 + Math.floor(Math.random() * 4)}-0${(Math.floor(Math.random() * 9) + 1)}-15`,
        },
      });
      students.push(student);
    }
  }

  // ===== Profiles (login accounts) =====
  // Super Admin
  await db.profile.create({
    data: {
      email: "superadmin@eduflow.com",
      password: hashPassword("admin123"),
      name: "Super Admin",
      role: "super_admin",
      status: "active",
    },
  });

  // School Admin
  await db.profile.create({
    data: {
      email: "admin@greenwood.edu",
      password: hashPassword("admin123"),
      name: "Rajesh Kumar",
      role: "school_admin",
      schoolId: school.id,
      staffId: staff[0].id,
      status: "active",
    },
  });

  // Teacher
  await db.profile.create({
    data: {
      email: teachers[0].email || "teacher@greenwood.edu",
      password: hashPassword("teacher123"),
      name: `${teachers[0].firstName} ${teachers[0].lastName}`,
      role: "teacher",
      schoolId: school.id,
      staffId: teachers[0].id,
      status: "active",
    },
  });

  // Accountant
  const accountant = staff.find((s) => staffData[staff.indexOf(s)]?.designation === "Accountant") || staff[8];
  await db.profile.create({
    data: {
      email: accountant.email || "accountant@greenwood.edu",
      password: hashPassword("account123"),
      name: `${accountant.firstName} ${accountant.lastName}`,
      role: "accountant",
      schoolId: school.id,
      staffId: accountant.id,
      status: "active",
    },
  });

  // Librarian
  const librarian = staff[9];
  await db.profile.create({
    data: {
      email: librarian.email || "librarian@greenwood.edu",
      password: hashPassword("library123"),
      name: `${librarian.firstName} ${librarian.lastName}`,
      role: "librarian",
      schoolId: school.id,
      staffId: librarian.id,
      status: "active",
    },
  });

  // Transport Manager
  const transportMgr = staff[10];
  await db.profile.create({
    data: {
      email: transportMgr.email || "transport@greenwood.edu",
      password: hashPassword("transport123"),
      name: `${transportMgr.firstName} ${transportMgr.lastName}`,
      role: "transport_manager",
      schoolId: school.id,
      staffId: transportMgr.id,
      status: "active",
    },
  });

  // HR
  const hr = staff[11];
  await db.profile.create({
    data: {
      email: hr.email || "hr@greenwood.edu",
      password: hashPassword("hr123"),
      name: `${hr.firstName} ${hr.lastName}`,
      role: "hr",
      schoolId: school.id,
      staffId: hr.id,
      status: "active",
    },
  });

  // Student login (first student)
  if (students[0]) {
    await db.profile.create({
      data: {
        email: students[0].email || "student@greenwood.edu",
        password: hashPassword("student123"),
        name: `${students[0].firstName} ${students[0].lastName}`,
        role: "student",
        schoolId: school.id,
        studentId: students[0].id,
        status: "active",
      },
    });

    // Parent login
    await db.profile.create({
      data: {
        email: students[0].parentEmail || "parent@gmail.com",
        password: hashPassword("parent123"),
        name: `Parent of ${students[0].firstName}`,
        role: "parent",
        schoolId: school.id,
        studentId: students[0].id,
        status: "active",
      },
    });
  }

  // ===== Attendance (last 30 days for first 20 students) =====
  const today = new Date();
  const attendanceStatuses = ["present", "present", "present", "present", "absent", "late", "leave"];
  for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
    const date = new Date(today);
    date.setDate(date.getDate() - dayOffset);
    if (date.getDay() === 0) continue; // skip Sunday
    const dateStr = date.toISOString().split("T")[0];
    for (const student of students.slice(0, 40)) {
      await db.studentAttendance.create({
        data: {
          studentId: student.id,
          date: dateStr,
          status: attendanceStatuses[Math.floor(Math.random() * attendanceStatuses.length)],
          markedBy: "system",
        },
      });
    }
  }

  // ===== Fee Structures =====
  for (const cls of classes.slice(3, 13)) {
    const fs = await db.feeStructure.create({
      data: {
        name: `${cls.name} - Annual Fee 2024-25`,
        classId: cls.id,
        schoolId: school.id,
        term: "Annual",
        totalAmount: 45000 + (classes.indexOf(cls) * 2000),
        dueDate: "2024-12-31",
      },
    });
    // Fee items
    const items = [
      { name: "Tuition Fee", amount: 30000 + (classes.indexOf(cls) * 1500) },
      { name: "Library Fee", amount: 2000 },
      { name: "Exam Fee", amount: 3000 },
      { name: "Lab Fee", amount: 4000 },
      { name: "Sports Fee", amount: 1500 },
    ];
    for (const item of items) {
      await db.feeItem.create({
        data: { feeStructureId: fs.id, ...item },
      });
    }
  }

  // Assign fees to students and create payments
  let receiptCounter = 5001;
  for (const student of students) {
    if (!student.classId) continue;
    const feeStruct = await db.feeStructure.findFirst({
      where: { classId: student.classId },
    });
    if (!feeStruct) continue;

    const paymentStatus = Math.random();
    let paidAmount = 0;
    let status = "pending";
    if (paymentStatus > 0.7) {
      paidAmount = feeStruct.totalAmount;
      status = "paid";
    } else if (paymentStatus > 0.3) {
      paidAmount = Math.floor(feeStruct.totalAmount * 0.5);
      status = "partial";
    } else {
      paidAmount = 0;
      status = "pending";
    }

    const studentFee = await db.studentFee.create({
      data: {
        studentId: student.id,
        feeStructureId: feeStruct.id,
        totalAmount: feeStruct.totalAmount,
        paidAmount,
        dueAmount: feeStruct.totalAmount - paidAmount,
        dueDate: feeStruct.dueDate,
        status,
      },
    });

    if (paidAmount > 0) {
      await db.feePayment.create({
        data: {
          studentFeeId: studentFee.id,
          amount: paidAmount,
          paymentMethod: ["cash", "online", "cheque"][Math.floor(Math.random() * 3)],
          paymentDate: `2024-0${Math.floor(Math.random() * 9) + 1}-1${Math.floor(Math.random() * 9)}`,
          receiptNumber: `RCP${receiptCounter++}`,
          collectedBy: "Deepak Mehta",
        },
      });
    }
  }

  // ===== Library Books =====
  const booksData = [
    { title: "The Great Gatsby", author: "F. Scott Fitzgerald", category: "Fiction", isbn: "9780743273565" },
    { title: "To Kill a Mockingbird", author: "Harper Lee", category: "Fiction", isbn: "9780061120084" },
    { title: "A Brief History of Time", author: "Stephen Hawking", category: "Science", isbn: "9780553380163" },
    { title: "The Selfish Gene", author: "Richard Dawkins", category: "Science", isbn: "9780198575191" },
    { title: "Wings of Fire", author: "A.P.J. Abdul Kalam", category: "Biography", isbn: "9788173711466" },
    { title: "The Alchemist", author: "Paulo Coelho", category: "Fiction", isbn: "9780061122415" },
    { title: "Mathematics for Class 10", author: "R.D. Sharma", category: "Textbook", isbn: "9789388700001" },
    { title: "Physics Principles", author: "H.C. Verma", category: "Textbook", isbn: "9788177091874" },
    { title: "Indian History", author: "Bipin Chandra", category: "History", isbn: "9788125036842" },
    { title: "The Discovery of India", author: "Jawaharlal Nehru", category: "History", isbn: "9780143031031" },
    { title: "Wuthering Heights", author: "Emily Bronte", category: "Fiction", isbn: "9780141439556" },
    { title: "Pride and Prejudice", author: "Jane Austen", category: "Fiction", isbn: "9780141439518" },
    { title: "Programming in Python", author: "Mark Lutz", category: "Technology", isbn: "9781449355739" },
    { title: "Data Structures", author: "Thomas Cormen", category: "Technology", isbn: "9780262033848" },
    { title: "Organic Chemistry", author: "Morrison Boyd", category: "Science", isbn: "9788131705099" },
  ];
  for (const b of booksData) {
    await db.libraryBook.create({
      data: {
        ...b,
        publisher: "Greenwood Press",
        totalCopies: 3 + Math.floor(Math.random() * 5),
        availableCopies: 2 + Math.floor(Math.random() * 4),
        shelfLocation: `Shelf ${String.fromCharCode(65 + Math.floor(Math.random() * 5))}-${Math.floor(Math.random() * 20) + 1}`,
        schoolId: school.id,
      },
    });
  }

  // Issue some books
  const allBooks = await db.libraryBook.findMany();
  for (let i = 0; i < 8 && i < students.length; i++) {
    const book = allBooks[i % allBooks.length];
    const issueDate = new Date(today);
    issueDate.setDate(issueDate.getDate() - 14);
    const dueDate = new Date(issueDate);
    dueDate.setDate(dueDate.getDate() + 7);
    await db.bookIssue.create({
      data: {
        bookId: book.id,
        studentId: students[i].id,
        borrowerName: `${students[i].firstName} ${students[i].lastName}`,
        issueDate: issueDate.toISOString().split("T")[0],
        dueDate: dueDate.toISOString().split("T")[0],
        status: i < 4 ? "issued" : "returned",
        returnDate: i < 4 ? null : new Date().toISOString().split("T")[0],
        fine: i < 4 && dueDate < today ? 20 : 0,
      },
    });
  }

  // ===== Transport =====
  const routesData = [
    { name: "Route 1 - North Delhi", stops: "Rohini,Pitampura,Model Town", fare: 1500 },
    { name: "Route 2 - South Delhi", stops: "Saket,Malviya Nagar,Pushp Vihar", fare: 1800 },
    { name: "Route 3 - East Delhi", stops: "Preet Vihar,Vikas Marg,Mayur Vihar", fare: 1600 },
    { name: "Route 4 - West Delhi", stops: "Janakpuri,Rajouri Garden,Punjabi Bagh", fare: 1700 },
    { name: "Route 5 - Noida", stops: "Sector 18,Sector 62,Atta Market", fare: 2000 },
  ];
  for (let i = 0; i < routesData.length; i++) {
    const r = routesData[i];
    const route = await db.transportRoute.create({
      data: { ...r, schoolId: school.id },
    });
    await db.vehicle.create({
      data: {
        busNumber: `DL01B${1000 + i}`,
        driverName: `Driver ${i + 1}`,
        driverPhone: `+91 9${String(900000000 + i * 222222).slice(0, 9)}`,
        capacity: 40,
        routeId: route.id,
        schoolId: school.id,
      },
    });
  }

  // Assign transport to some students
  const routes = await db.transportRoute.findMany();
  for (let i = 0; i < students.length; i++) {
    if (Math.random() > 0.5) {
      const route = routes[i % routes.length];
      const vehicle = await db.vehicle.findFirst({ where: { routeId: route.id } });
      await db.studentTransport.create({
        data: {
          studentId: students[i].id,
          routeId: route.id,
          vehicleId: vehicle?.id,
          pickupPoint: route.stops?.split(",")[i % route.stops.split(",").length] || "Main Gate",
        },
      });
    }
  }

  // ===== Exams & Results =====
  const exam = await db.exam.create({
    data: {
      name: "Mid-Term Examination 2024",
      type: "mid_term",
      schoolId: school.id,
      classId: classes[12].id, // Class 10
      startDate: "2024-09-15",
      endDate: "2024-09-25",
      maxMarks: 100,
    },
  });

  // Results for class 10 students
  const class10Students = students.filter((s) => s.classId === classes[12].id);
  const examSubjects = subjects.slice(0, 5);
  for (const student of class10Students) {
    for (const subject of examSubjects) {
      const marks = 55 + Math.floor(Math.random() * 45);
      const grade = marks >= 90 ? "A+" : marks >= 80 ? "A" : marks >= 70 ? "B+" : marks >= 60 ? "B" : marks >= 50 ? "C" : "D";
      await db.examResult.create({
        data: {
          examId: exam.id,
          studentId: student.id,
          subjectId: subject.id,
          marksObtained: marks,
          maxMarks: 100,
          grade,
        },
      });
    }
  }

  // ===== Homework =====
  const homeworkData = [
    { title: "Algebra - Quadratic Equations", subjectIdx: 1, classIdx: 12, desc: "Solve exercises 4.1 to 4.5 from textbook. Submit by Friday." },
    { title: "Essay - My Favorite Book", subjectIdx: 0, classIdx: 11, desc: "Write a 500-word essay on your favorite book and why you recommend it." },
    { title: "Science Project - Photosynthesis", subjectIdx: 2, classIdx: 10, desc: "Create a diagram showing the process of photosynthesis." },
    { title: "History - Independence Movement", subjectIdx: 3, classIdx: 12, desc: "Research and write about 3 key events in India's independence movement." },
    { title: "Hindi - Kabir ke Dohe", subjectIdx: 4, classIdx: 9, desc: "Memorize 5 dohe by Kabir and write their meaning." },
  ];
  for (const hw of homeworkData) {
    const cls = classes[hw.classIdx];
    const sec = sections.find((s) => s.classId === cls.id);
    const teacher = teachers[hw.subjectIdx % teachers.length];
    await db.homework.create({
      data: {
        title: hw.title,
        description: hw.desc,
        classId: cls.id,
        sectionId: sec?.id,
        subjectId: subjects[hw.subjectIdx].id,
        staffId: teacher.id,
        dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
        schoolId: school.id,
      },
    });
  }

  // ===== Notices =====
  const noticesData = [
    { title: "Annual Day Celebration", content: "The school's Annual Day will be celebrated on 25th December 2024. All students must participate. Rehearsals start from 15th December.", audience: "all" },
    { title: "Parent-Teacher Meeting", content: "PTM for Class 10 is scheduled for this Saturday from 9 AM to 12 PM. Parents are requested to attend.", audience: "class" },
    { title: "Fee Payment Reminder", content: "Parents are reminded that the last date for fee payment is 31st December. Please clear dues on time.", audience: "all" },
    { title: "Diwali Holiday", content: "School will remain closed from 10th to 15th November for Diwali celebrations. Classes resume on 16th November.", audience: "all" },
    { title: "Science Exhibition", content: "Annual Science Exhibition will be held on 20th November. Students from Class 6-10 must submit project ideas by 10th November.", audience: "all" },
  ];
  for (const n of noticesData) {
    await db.notice.create({
      data: {
        title: n.title,
        content: n.content,
        targetAudience: n.audience,
        postedBy: "Rajesh Kumar",
        date: new Date().toISOString().split("T")[0],
        schoolId: school.id,
      },
    });
  }

  // ===== Events =====
  const eventsData = [
    { title: "Annual Day", date: "2024-12-25", type: "function", desc: "Annual cultural function and prize distribution" },
    { title: "Diwali Break", date: "2024-11-10", endDate: "2024-11-15", type: "holiday", desc: "Diwali holidays" },
    { title: "Mid-Term Exam", date: "2024-09-15", endDate: "2024-09-25", type: "exam", desc: "Mid-term examinations for all classes" },
    { title: "PTM Class 10", date: "2024-11-30", type: "ptm", desc: "Parent-Teacher Meeting for Class 10" },
    { title: "Sports Day", date: "2024-11-05", type: "function", desc: "Annual sports day with various athletic events" },
    { title: "Christmas Holiday", date: "2024-12-25", type: "holiday", desc: "Christmas" },
  ];
  for (const e of eventsData) {
    await db.schoolEvent.create({
      data: {
        title: e.title,
        description: e.desc,
        date: e.date,
        endDate: e.endDate,
        type: e.type,
        schoolId: school.id,
      },
    });
  }

  // ===== Staff Leaves =====
  const leaveStaff = staff.slice(2, 8);
  for (let i = 0; i < 5; i++) {
    await db.staffLeave.create({
      data: {
        staffId: leaveStaff[i].id,
        fromDate: `2024-1${i}-0${i + 1}`,
        toDate: `2024-1${i}-0${i + 3}`,
        reason: i % 2 === 0 ? "Medical leave" : "Personal work",
        type: i % 2 === 0 ? "sick" : "casual",
        status: i < 3 ? "approved" : i < 4 ? "pending" : "rejected",
        approvedBy: i < 3 ? "Rajesh Kumar" : null,
      },
    });
  }

  // ===== Payroll =====
  const month = today.getMonth();
  const year = today.getFullYear();
  for (const s of staff) {
    const staffFull = await db.staff.findUnique({ where: { id: s.id } });
    if (!staffFull) continue;
    const basic = staffFull.salary;
    const allowances = basic * 0.2;
    const deductions = basic * 0.1;
    await db.payroll.create({
      data: {
        staffId: s.id,
        month,
        year,
        basicSalary: basic,
        allowances,
        deductions,
        netSalary: basic + allowances - deductions,
        status: Math.random() > 0.5 ? "paid" : "pending",
        paidDate: Math.random() > 0.5 ? `${year}-${String(month + 1).padStart(2, "0")}-01` : null,
      },
    });
  }

  console.log("Seed completed successfully!");
  console.log(`Created: ${classes.length} classes, ${sections.length} sections, ${subjects.length} subjects, ${students.length} students, ${staff.length} staff`);
  console.log("\nLogin credentials:");
  console.log("Super Admin: superadmin@eduflow.com / admin123");
  console.log("School Admin: admin@greenwood.edu / admin123");
  console.log("Teacher: " + teachers[0].email + " / teacher123");
  console.log("Accountant: " + accountant.email + " / account123");
  console.log("Librarian: " + librarian.email + " / library123");
  console.log("Transport: " + transportMgr.email + " / transport123");
  console.log("HR: " + hr.email + " / hr123");
  if (students[0]) {
    console.log("Student: " + students[0].email + " / student123");
    console.log("Parent: " + students[0].parentEmail + " / parent123");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
