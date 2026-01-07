const express = require("express");
const router = express.Router();

// Mock database
let employees = [
    { id: 1, name: "John Doe", position: "Software Engineer", salary: 75000 },
    { id: 2, name: "Jane Smith", position: "Product Manager", salary: 85000 },
];

// GET all employees
router.get("/", (req, res) => {
    res.json(employees);
});

// GET employee by ID
router.get("/:id", (req, res) => {
    const employee = employees.find((e) => e.id === parseInt(req.params.id));
    if (!employee) return res.status(404).json({ message: "Employee not found" });
    res.json(employee);
});

// POST new employee
router.post("/", (req, res) => {
    const { name, position, salary } = req.body;
    if (!name || !position) {
        return res.status(400).json({ message: "Name and Position are required" });
    }
    const newEmployee = {
        id: employees.length + 1,
        name,
        position,
        salary: salary || 0,
    };
    employees.push(newEmployee);
    res.status(201).json(newEmployee);
});

// PUT update employee
router.put("/:id", (req, res) => {
    const employee = employees.find((e) => e.id === parseInt(req.params.id));
    if (!employee) return res.status(404).json({ message: "Employee not found" });

    const { name, position, salary } = req.body;
    employee.name = name || employee.name;
    employee.position = position || employee.position;
    employee.salary = salary || employee.salary;

    res.json(employee);
});

// DELETE employee
router.delete("/:id", (req, res) => {
    const index = employees.findIndex((e) => e.id === parseInt(req.params.id));
    if (index === -1) return res.status(404).json({ message: "Employee not found" });

    employees.splice(index, 1);
    res.status(204).send();
});

module.exports = router;
