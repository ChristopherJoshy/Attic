// ---------------------------------------------------------------------------
// Rich mock domain model for the KTU Student Portal revamp.
// Everything here is mock data — no backend. Login is mocked.
// ---------------------------------------------------------------------------

export interface SubjectResult {
  code: string;
  name: string;
  grade: string;
  credits: number;
  marks: number;
  status: "Pass" | "Fail" | "Absent";
  type: "Theory" | "Lab" | "Project";
}

export interface SemesterRecord {
  id: string;
  semester: number; // 1..8
  scheme: string;
  sgpa: number;
  creditsEarned: number;
  creditsTotal: number;
  status: "Passed" | "Failed" | "Pending";
  resultDate: string;
  subjects: SubjectResult[];
}

export interface AttendanceCourse {
  code: string;
  name: string;
  faculty: string;
  present: number;
  total: number;
  requiredPct: number; // KTU minimum (usually 75)
}

export interface ExamEvent {
  id: string;
  subjectCode: string;
  subject: string;
  date: string;
  day: string;
  session: "FN" | "AN";
  time: string;
  venue: string;
  duration: string;
  type: "Regular" | "Supplementary" | "Improvement" | "Honours";
  status: "Registered" | "Pending" | "Closed";
}

export interface ExamRegistration {
  id: string;
  name: string;
  type: "Regular" | "Supplementary" | "Improvement" | "Honours";
  status: "Registered" | "Pending" | "Closed";
  date: string;
  fee: number;
  lastDate: string;
}

export interface RevaluationRequest {
  id: string;
  subjectCode: string;
  subject: string;
  currentGrade: string;
  status: "Requested" | "Under Review" | "Completed";
  fee: number;
  requestedOn: string;
}

export interface FeeItem {
  id: string;
  name: string;
  category: "Tuition" | "Exam" | "University" | "Insurance" | "Other";
  semester: string;
  amount: number;
  status: "Paid" | "Unpaid" | "Partial";
  txnId?: string;
  date?: string;
  dueDate?: string;
}

export interface SurakshaPolicy {
  policyName: string;
  partner: string;
  policyNumber: string;
  coverageFrom: string;
  coverageTo: string;
  premium: number;
  premiumStatus: "Paid" | "Unpaid";
  insuredName: string;
  insuredRoll: string;
  nominee: string;
  benefits: { event: string; amount: string; remarks: string }[];
}

export interface FeedbackCourse {
  code: string;
  name: string;
  faculty: string;
  status: "Completed" | "Pending";
  date?: string;
}

export interface Certificate {
  id: string;
  name: string;
  type: "Provisional" | "Course Completion" | "Transfer" | "Conduct" | "Bonafide" | "Grade Sheet";
  requestedOn?: string;
  status: "Ready" | "Processing" | "Not Requested";
  issuedOn?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  endDate?: string;
  category: "Exam" | "Holiday" | "Event" | "Deadline" | "Result";
  description: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  time: string;
  read: boolean;
  category: "alert" | "exam" | "fee" | "result" | "info";
}

export interface Grievance {
  id: string;
  subject: string;
  category: "Academic" | "Exam" | "Fee" | "Technical" | "General";
  description: string;
  status: "Open" | "In Progress" | "Resolved";
  raisedOn: string;
  expectedBy: string;
  ticket: string;
}

export interface StudentProfile {
  name: string;
  rollNumber: string;
  admissionNumber: string;
  college: string;
  collegeCode: string;
  program: string;
  branch: string;
  scheme: string;
  semester: number;
  admissionYear: number;
  email: string;
  phone: string;
  address: string;
  personal: {
    gender: string;
    dob: string;
    bloodGroup: string;
    religion: string;
    community: string;
    nationality: string;
    motherTongue: string;
    category: string;
    guardian: string;
    guardianPhone: string;
  };
}

export const studentData: StudentProfile = {
  name: "Christopher Joshy",
  rollNumber: "KTU21CS045",
  admissionNumber: "2021CS045",
  college: "St Joseph's College of Engineering and Technology, Palai",
  collegeCode: "SJCET",
  program: "B.Tech",
  branch: "Computer Science & Engineering",
  scheme: "2019 Scheme",
  semester: 6,
  admissionYear: 2021,
  email: "christopher.joshy@sjcet.ac.in",
  phone: "+91 94472 10382",
  address: "Joshy Nivas, Kadanad P.O., Kottayam, Kerala - 686653",
  personal: {
    gender: "Male",
    dob: "15-08-2002",
    bloodGroup: "O+",
    religion: "Christian",
    community: "Latin Catholic",
    nationality: "Indian",
    motherTongue: "Malayalam",
    category: "General",
    guardian: "Joshy K. V.",
    guardianPhone: "+91 94470 55321",
  },
};

// Total credits required across the programme (KTU ~ 180 for B.Tech)
export const CREDITS_REQUIRED = 180;

export const semesterRecords: SemesterRecord[] = [
  {
    id: "S1",
    semester: 1,
    scheme: "2019",
    sgpa: 7.92,
    creditsEarned: 21,
    creditsTotal: 22,
    status: "Passed",
    resultDate: "18 Feb 2022",
    subjects: [
      { code: "MA101", name: "Calculus & Linear Algebra", grade: "A", credits: 4, marks: 84, status: "Pass", type: "Theory" },
      { code: "PH100", name: "Engineering Physics", grade: "B+", credits: 4, marks: 77, status: "Pass", type: "Theory" },
      { code: "CY100", name: "Engineering Chemistry", grade: "A", credits: 4, marks: 81, status: "Pass", type: "Theory" },
      { code: "BE100", name: "Engineering Mechanics", grade: "B", credits: 3, marks: 71, status: "Pass", type: "Theory" },
      { code: "CS100", name: "Computer Programming", grade: "S", credits: 3, marks: 94, status: "Pass", type: "Theory" },
      { code: "CS110", name: "Computer Programming Lab", grade: "A+", credits: 4, marks: 90, status: "Pass", type: "Lab" },
    ],
  },
  {
    id: "S2",
    semester: 2,
    scheme: "2019",
    sgpa: 8.21,
    creditsEarned: 22,
    creditsTotal: 22,
    status: "Passed",
    resultDate: "20 Jun 2022",
    subjects: [
      { code: "MA102", name: "Vector Calculus & Complex Analysis", grade: "A", credits: 4, marks: 83, status: "Pass", type: "Theory" },
      { code: "EE100", name: "Basic Electrical Engg.", grade: "B+", credits: 3, marks: 76, status: "Pass", type: "Theory" },
      { code: "ME100", name: "Basic Mechanical Engg.", grade: "B", credits: 3, marks: 70, status: "Pass", type: "Theory" },
      { code: "EC100", name: "Basic Electronics Engg.", grade: "A", credits: 3, marks: 82, status: "Pass", type: "Theory" },
      { code: "HS100", name: "Professional Communication", grade: "A+", credits: 3, marks: 89, status: "Pass", type: "Theory" },
      { code: "CS120", name: "Python Programming Lab", grade: "S", credits: 4, marks: 96, status: "Pass", type: "Lab" },
      { code: "ME110", name: "Workshop Practice", grade: "A", credits: 2, marks: 85, status: "Pass", type: "Lab" },
    ],
  },
  {
    id: "S3",
    semester: 3,
    scheme: "2019",
    sgpa: 8.04,
    creditsEarned: 23,
    creditsTotal: 23,
    status: "Passed",
    resultDate: "12 Jan 2023",
    subjects: [
      { code: "MA201", name: "Transforms & Differential Eqns.", grade: "B+", credits: 4, marks: 78, status: "Pass", type: "Theory" },
      { code: "CS201", name: "Discrete Computational Methods", grade: "A", credits: 4, marks: 85, status: "Pass", type: "Theory" },
      { code: "CS203", name: "Digital Systems", grade: "A", credits: 4, marks: 88, status: "Pass", type: "Theory" },
      { code: "CS205", name: "Data Structures", grade: "B+", credits: 4, marks: 79, status: "Pass", type: "Theory" },
      { code: "CS231", name: "Data Structures Lab", grade: "S", credits: 4, marks: 93, status: "Pass", type: "Lab" },
      { code: "HS200", name: "Economics for Engineers", grade: "B", credits: 3, marks: 72, status: "Pass", type: "Theory" },
    ],
  },
  {
    id: "S4",
    semester: 4,
    scheme: "2019",
    sgpa: 8.36,
    creditsEarned: 24,
    creditsTotal: 24,
    status: "Passed",
    resultDate: "05 Jun 2023",
    subjects: [
      { code: "CS202", name: "Object Oriented Programming", grade: "A", credits: 4, marks: 86, status: "Pass", type: "Theory" },
      { code: "CS204", name: "Computer Organisation", grade: "A+", credits: 4, marks: 91, status: "Pass", type: "Theory" },
      { code: "CS206", name: "Database Systems", grade: "A", credits: 4, marks: 84, status: "Pass", type: "Theory" },
      { code: "CS208", name: "Operating Systems", grade: "B+", credits: 4, marks: 77, status: "Pass", type: "Theory" },
      { code: "CS232", name: "OOP & DBMS Lab", grade: "S", credits: 4, marks: 95, status: "Pass", type: "Lab" },
      { code: "EC202", name: "Linear Integrated Circuits", grade: "B", credits: 4, marks: 69, status: "Pass", type: "Theory" },
    ],
  },
  {
    id: "S5",
    semester: 5,
    scheme: "2019",
    sgpa: 8.45,
    creditsEarned: 23,
    creditsTotal: 24,
    status: "Passed",
    resultDate: "14 Dec 2023",
    subjects: [
      { code: "CS301", name: "Formal Languages & Automata Theory", grade: "A", credits: 4, marks: 85, status: "Pass", type: "Theory" },
      { code: "CS303", name: "System Software", grade: "B+", credits: 3, marks: 78, status: "Pass", type: "Theory" },
      { code: "CS305", name: "Computer Architecture", grade: "A+", credits: 4, marks: 92, status: "Pass", type: "Theory" },
      { code: "CS307", name: "Data Communication", grade: "B", credits: 3, marks: 70, status: "Pass", type: "Theory" },
      { code: "CS309", name: "Graph Theory & Combinatorics", grade: "A", credits: 3, marks: 83, status: "Pass", type: "Theory" },
      { code: "CS331", name: "System Software Lab", grade: "S", credits: 4, marks: 96, status: "Pass", type: "Lab" },
      { code: "CS341", name: "Mini Project", grade: "A", credits: 3, marks: 87, status: "Pass", type: "Project" },
    ],
  },
  {
    id: "S6",
    semester: 6,
    scheme: "2019",
    sgpa: 0,
    creditsEarned: 0,
    creditsTotal: 24,
    status: "Pending",
    resultDate: "—",
    subjects: [
      { code: "CS302", name: "Compiler Design", grade: "—", credits: 4, marks: 0, status: "Absent", type: "Theory" },
      { code: "CS304", name: "Machine Learning", grade: "—", credits: 4, marks: 0, status: "Absent", type: "Theory" },
      { code: "CS306", name: "Computer Networks", grade: "—", credits: 4, marks: 0, status: "Absent", type: "Theory" },
      { code: "CS308", name: "Software Engineering", grade: "—", credits: 3, marks: 0, status: "Absent", type: "Theory" },
      { code: "CS310", name: "Cloud Computing", grade: "—", credits: 3, marks: 0, status: "Absent", type: "Theory" },
      { code: "CS332", name: "Network & ML Lab", grade: "—", credits: 4, marks: 0, status: "Absent", type: "Lab" },
      { code: "CS342", name: "Industrial Training / Internship", grade: "—", credits: 2, marks: 0, status: "Absent", type: "Project" },
    ],
  },
];

export const attendance: AttendanceCourse[] = [
  { code: "CS302", name: "Compiler Design", faculty: "Dr. Elizabeth Philip", present: 58, total: 72, requiredPct: 75 },
  { code: "CS304", name: "Machine Learning", faculty: "Prof. Jinesh George", present: 64, total: 70, requiredPct: 75 },
  { code: "CS306", name: "Computer Networks", faculty: "Dr. Susan Manoj", present: 49, total: 71, requiredPct: 75 },
  { code: "CS308", name: "Software Engineering", faculty: "Prof. Anoop Thomas", present: 61, total: 68, requiredPct: 75 },
  { code: "CS310", name: "Cloud Computing", faculty: "Dr. Ravi Menon", present: 55, total: 69, requiredPct: 75 },
  { code: "CS332", name: "Network & ML Lab", faculty: "Prof. Priya K. S.", present: 30, total: 34, requiredPct: 75 },
  { code: "CS342", name: "Industrial Training", faculty: "Placement Cell", present: 11, total: 12, requiredPct: 75 },
];

export const examRegistrations: ExamRegistration[] = [
  { id: "1", name: "B.Tech S6 (R,S) Regular Exam", type: "Regular", status: "Registered", date: "12 May 2024", fee: 1200, lastDate: "10 Apr 2024" },
  { id: "2", name: "B.Tech S6 (Hons.) Exam", type: "Honours", status: "Pending", date: "15 May 2024", fee: 600, lastDate: "10 Apr 2024" },
  { id: "3", name: "B.Tech S5 Supplementary Exam", type: "Supplementary", status: "Closed", date: "10 Dec 2023", fee: 300, lastDate: "15 Nov 2023" },
  { id: "4", name: "B.Tech S4 Improvement Exam", type: "Improvement", status: "Closed", date: "08 Jun 2023", fee: 250, lastDate: "20 May 2023" },
];

export const examTimetable: ExamEvent[] = [
  { id: "e1", subjectCode: "CS302", subject: "Compiler Design", date: "12 May 2024", day: "Sunday", session: "FN", time: "09:30 – 12:30", venue: "BLOCK C / 302", duration: "3 hrs", type: "Regular", status: "Registered" },
  { id: "e2", subjectCode: "CS304", subject: "Machine Learning", date: "15 May 2024", day: "Wednesday", session: "AN", time: "14:00 – 17:00", venue: "BLOCK C / 305", duration: "3 hrs", type: "Regular", status: "Registered" },
  { id: "e3", subjectCode: "CS306", subject: "Computer Networks", date: "18 May 2024", day: "Saturday", session: "FN", time: "09:30 – 12:30", venue: "BLOCK C / 301", duration: "3 hrs", type: "Regular", status: "Registered" },
  { id: "e4", subjectCode: "CS308", subject: "Software Engineering", date: "21 May 2024", day: "Tuesday", session: "AN", time: "14:00 – 17:00", venue: "BLOCK C / 308", duration: "3 hrs", type: "Regular", status: "Registered" },
  { id: "e5", subjectCode: "CS310", subject: "Cloud Computing", date: "24 May 2024", day: "Friday", session: "FN", time: "09:30 – 12:30", venue: "BLOCK C / 304", duration: "3 hrs", type: "Regular", status: "Registered" },
  { id: "e6", subjectCode: "CS332", subject: "Network & ML Lab", date: "28 May 2024", day: "Tuesday", session: "FN", time: "09:30 – 12:30", venue: "LAB 2 / CSE", duration: "3 hrs", type: "Regular", status: "Registered" },
  { id: "e7", subjectCode: "CS342", subject: "Industrial Training Viva", date: "30 May 2024", day: "Thursday", session: "AN", time: "14:00 – 16:00", venue: "SEM HALL / CSE", duration: "2 hrs", type: "Regular", status: "Registered" },
];

export const revaluationRequests: RevaluationRequest[] = [
  { id: "r1", subjectCode: "EC202", subject: "Linear Integrated Circuits (S4)", currentGrade: "B", status: "Completed", fee: 500, requestedOn: "12 Jun 2023" },
  { id: "r2", subjectCode: "CS307", subject: "Data Communication (S5)", currentGrade: "B", status: "Under Review", fee: 500, requestedOn: "20 Dec 2023" },
];

export const feeLedger: FeeItem[] = [
  { id: "f1", name: "S6 Examination Fee", category: "Exam", semester: "Semester 6", amount: 1200, status: "Unpaid", dueDate: "10 Apr 2024" },
  { id: "f2", name: "S6 Tuition Fee", category: "Tuition", semester: "Semester 6", amount: 7500, status: "Paid", txnId: "TXN98273641", date: "04 Jan 2024" },
  { id: "f3", name: "S6 Honours Registration Fee", category: "Exam", semester: "Semester 6", amount: 600, status: "Unpaid", dueDate: "10 Apr 2024" },
  { id: "f4", name: "S5 Examination Fee", category: "Exam", semester: "Semester 5", amount: 1200, status: "Paid", txnId: "TXN87162544", date: "12 Nov 2023" },
  { id: "f5", name: "Student Suraksha Scheme Premium", category: "Insurance", semester: "Annual", amount: 100, status: "Paid", txnId: "TXN44738291", date: "10 Aug 2023" },
  { id: "f6", name: "Admission & University Registration", category: "University", semester: "Semester 1", amount: 1500, status: "Paid", txnId: "TXN11029384", date: "01 Aug 2022" },
  { id: "f7", name: "S4 Improvement Exam Fee", category: "Exam", semester: "Semester 4", amount: 250, status: "Paid", txnId: "TXN55291033", date: "20 May 2023" },
];

export const suraksha: SurakshaPolicy = {
  policyName: "Group Personal Accident Insurance (GPAI)",
  partner: "National Insurance Company Ltd.",
  policyNumber: "KTU/GPAI/2023-24/09872",
  coverageFrom: "01 Aug 2023",
  coverageTo: "31 Jul 2024",
  premium: 100,
  premiumStatus: "Paid",
  insuredName: "Christopher Joshy",
  insuredRoll: "KTU21CS045",
  nominee: "Joshy K. V. (Father)",
  benefits: [
    { event: "Accidental Death", amount: "₹10,00,000", remarks: "Payable to nominee / legal heirs" },
    { event: "Permanent Total Disablement", amount: "₹10,00,000", remarks: "Medical board certification required" },
    { event: "Hospitalization (Accident)", amount: "Up to ₹1,00,000", remarks: "Inpatient treatment at approved hospitals" },
    { event: "Loss of two limbs / both eyes", amount: "₹10,00,000", remarks: "Due to accidental injury" },
  ],
};

export const feedbackCourses: FeedbackCourse[] = [
  { code: "CS301", name: "Formal Languages & Automata Theory", faculty: "Dr. Elizabeth Philip", status: "Completed", date: "04 Jan 2024" },
  { code: "CS303", name: "System Software", faculty: "Prof. Jinesh George", status: "Pending" },
  { code: "CS305", name: "Computer Architecture & Org.", faculty: "Prof. Anoop Thomas", status: "Pending" },
  { code: "CS307", name: "Data Communication", faculty: "Dr. Susan Manoj", status: "Pending" },
  { code: "CS309", name: "Graph Theory & Combinatorics", faculty: "Prof. Priya K. S.", status: "Completed", date: "05 Jan 2024" },
  { code: "CS331", name: "System Software Lab", faculty: "Prof. Jinesh George", status: "Pending" },
];

export const certificates: Certificate[] = [
  { id: "c1", name: "Provisional Certificate", type: "Provisional", status: "Ready", issuedOn: "10 Jan 2024" },
  { id: "c2", name: "Course & Conduct Certificate", type: "Conduct", status: "Ready", issuedOn: "08 Jan 2024" },
  { id: "c3", name: "Bonafide Certificate", type: "Bonafide", status: "Ready", issuedOn: "12 Feb 2024" },
  { id: "c4", name: "Consolidated Grade Sheet", type: "Grade Sheet", status: "Processing", requestedOn: "02 Mar 2024" },
  { id: "c5", name: "Transfer Certificate", type: "Transfer", status: "Not Requested" },
  { id: "c6", name: "Course Completion Certificate", type: "Course Completion", status: "Not Requested" },
];

export const calendarEvents: CalendarEvent[] = [
  { id: "cal1", title: "S6 Regular Exam Commences", date: "12 May 2024", category: "Exam", description: "B.Tech S6 (R,S) Regular examinations begin across centres." },
  { id: "cal2", title: "Honours Exam Registration Closes", date: "10 Apr 2024", category: "Deadline", description: "Last date to register for B.Tech S6 Honours examinations." },
  { id: "cal3", title: "S6 Exam Fee Due", date: "10 Apr 2024", category: "Deadline", description: "Exam fee remittance deadline for S6 regular examinations." },
  { id: "cal4", title: "Onam Holidays", date: "11 Sep 2024", endDate: "16 Sep 2024", category: "Holiday", description: "University closed for Onam celebrations." },
  { id: "cal5", title: "S5 Result Publication", date: "14 Dec 2023", category: "Result", description: "B.Tech S5 (R,S) results published on the portal." },
  { id: "cal6", title: "Even Semester Classes Begin", date: "02 Jan 2024", category: "Event", description: "S6 classes commence for the even semester." },
  { id: "cal7", title: "Republic Day", date: "26 Jan 2024", category: "Holiday", description: "University holiday." },
  { id: "cal8", title: "S4 Result Publication", date: "05 Jun 2023", category: "Result", description: "B.Tech S4 (R,S) results published." },
];

export const notifications: NotificationItem[] = [
  { id: "n1", title: "S6 Honours registration closing soon", body: "Register for B.Tech S6 (Hons.) exam before 10 Apr 2024 to avoid late fee.", time: "2h ago", read: false, category: "exam" },
  { id: "n2", title: "Exam fee due", body: "S6 examination fee of ₹1,200 is pending. Clear dues to download hall ticket.", time: "5h ago", read: false, category: "fee" },
  { id: "n3", title: "Attendance deficiency", body: "Your attendance in Computer Networks (CS306) is below 75%. Condonation may be required.", time: "1d ago", read: false, category: "alert" },
  { id: "n4", title: "S5 Result published", body: "B.Tech S5 results are now available. SGPA: 8.45.", time: "3d ago", read: true, category: "result" },
  { id: "n5", title: "Course feedback pending", body: "Submit internal feedback for S5 courses to enable result viewing.", time: "4d ago", read: true, category: "info" },
];

export const grievances: Grievance[] = [
  { id: "g1", subject: "Delayed publication of S4 improvement result", category: "Exam", description: "Requesting an update on the S4 improvement examination result declared on 08 Jun 2023.", status: "Resolved", raisedOn: "12 Jun 2023", expectedBy: "15 Jun 2023", ticket: "KTU-GRV-2291" },
  { id: "g2", subject: "Correction in address field of profile", category: "Academic", description: "The permanent address PIN code reflects incorrectly. Kindly allow edit or correction.", status: "In Progress", raisedOn: "28 Feb 2024", expectedBy: "02 Mar 2024", ticket: "KTU-GRV-4487" },
];

// --------------------------- Derived helpers -------------------------------

export interface ProgramStats {
  cgpa: number;
  creditsEarned: number;
  creditsRequired: number;
  creditsPending: number;
  semestersCleared: number;
  totalSemesters: number;
}

export function getProgramStats(): ProgramStats {
  const completed = semesterRecords.filter((s) => s.status === "Passed");
  const creditsEarned = completed.reduce((sum, s) => sum + s.creditsEarned, 0);
  const cgpa =
    completed.reduce((sum, s) => sum + s.sgpa * s.creditsEarned, 0) /
    (creditsEarned || 1);
  return {
    cgpa: Number(cgpa.toFixed(2)),
    creditsEarned,
    creditsRequired: CREDITS_REQUIRED,
    creditsPending: CREDITS_REQUIRED - creditsEarned,
    semestersCleared: completed.length,
    totalSemesters: semesterRecords.length,
  };
}

export function getSemesterById(id: string): SemesterRecord | undefined {
  return semesterRecords.find((s) => s.id === id);
}
