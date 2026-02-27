# Transport Fee System - Setup Guide

## Overview
This transport fee system allows you to:
- Define multiple transport routes with different fee amounts
- Assign/unassign students to transport facilities
- Automatically calculate transport fees only for assigned students
- Manage transport routes dynamically

---

## Database Tables

### 1. **transport_routes** (New Table)
Stores all available transport routes and their fee amounts.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Route ID (Primary Key) |
| route_name | TEXT | Name of the route (e.g., "North Route", "South Route") |
| route_description | TEXT | Description of the route |
| fee_amount | REAL | Monthly transport fee for this route |
| destination | TEXT | Final destination of the route |
| vehicle_id | TEXT | Vehicle identifier/number |
| status | TEXT | 'Active' or 'Inactive' |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

### 2. **students** Table - New Columns
Added two new columns to track transport assignment:

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| transport_assigned | INTEGER | 0 | 1 = Assigned to transport, 0 = Not assigned |
| transport_route_id | INTEGER | NULL | Foreign key to transport_routes table |

---

## API Endpoints

### Transport Routes Management

#### 1. **Get All Routes**
```
GET /api/transport/routes
```
**Response:**
```json
[
  {
    "id": 1,
    "route_name": "North Route",
    "route_description": "North side daily shuttle",
    "fee_amount": 1500,
    "destination": "North Gate",
    "vehicle_id": "NR-01",
    "status": "Active"
  }
]
```

#### 2. **Create New Route**
```
POST /api/transport/routes
Content-Type: application/json

{
  "route_name": "South Route",
  "route_description": "South side daily shuttle",
  "fee_amount": 1200,
  "destination": "South Gate",
  "vehicle_id": "SR-01",
  "status": "Active"
}
```

#### 3. **Update Route**
```
PUT /api/transport/routes/{route_id}
Content-Type: application/json

{
  "route_name": "South Route",
  "fee_amount": 1500,
  "status": "Active"
}
```

---

### Student Transport Assignment

#### 4. **Assign Transport to Student**
```
POST /api/students/{student_id}/transport
Content-Type: application/json

{
  "transport_assigned": 1,
  "transport_route_id": 1
}
```
- `transport_assigned`: 1 = Yes, 0 = No (Unassign)
- `transport_route_id`: ID of the route to assign

#### 5. **Get Student's Transport Fee**
```
GET /api/students/{student_id}/transport-fee
```
**Response:**
```json
{
  "student_id": 5,
  "transport_assigned": 1,
  "transport_route_id": 1,
  "transport_fee": 1500
}
```
**Note:** `transport_fee` will be 0 if student is not assigned to any transport.

#### 6. **Get All Students by Transport Status**
```
GET /api/transport/students
```
**Response:**
```json
{
  "assigned": [
    {
      "id": 5,
      "roll_no": "A001",
      "name": "John Doe",
      "class_name": "10A",
      "route_name": "North Route",
      "fee_amount": 1500
    }
  ],
  "unassigned": [
    {
      "id": 3,
      "roll_no": "A003",
      "name": "Jane Smith",
      "class_name": "9B"
    }
  ],
  "assigned_count": 45,
  "unassigned_count": 155
}
```

---

## Fee Calculation Logic

### How Transport Fees Work:

1. **If student is NOT assigned transport:**
   - Transport fee = **₹0**
   - No transport fee charged

2. **If student IS assigned to a route:**
   - Transport fee = **Route's fee_amount**
   - E.g., If assigned to "North Route" with ₹1500/month → student pays ₹1500

3. **Total student fees = Base fees + Transport fee (if assigned)**

---

## Implementation Steps

### Step 1: Create Transport Routes
```bash
# Create "North Route" with ₹1500/month fee
POST /api/transport/routes
{
  "route_name": "North Route",
  "fee_amount": 1500,
  "destination": "North Gate",
  "vehicle_id": "NR-01"
}

# Create "South Route" with ₹1200/month fee
POST /api/transport/routes
{
  "route_name": "South Route",
  "fee_amount": 1200,
  "destination": "South Gate",
  "vehicle_id": "SR-01"
}

# Create "East Route" with ₹1300/month fee
POST /api/transport/routes
{
  "route_name": "East Route",
  "fee_amount": 1300,
  "destination": "East Gate",
  "vehicle_id": "ER-01"
}
```

### Step 2: Assign Students to Routes
```bash
# Assign student ID 5 to North Route
POST /api/students/5/transport
{
  "transport_assigned": 1,
  "transport_route_id": 1
}

# Assign student ID 10 to South Route
POST /api/students/10/transport
{
  "transport_assigned": 1,
  "transport_route_id": 2
}
```

### Step 3: Verify Assignments
```bash
# Check all transport assignments
GET /api/transport/students

# Check specific student's transport fee
GET /api/students/5/transport-fee
```

### Step 4: Update When Needed
```bash
# Change student 5 from North Route to South Route
POST /api/students/5/transport
{
  "transport_assigned": 1,
  "transport_route_id": 2
}

# Remove transport for student 5
POST /api/students/5/transport
{
  "transport_assigned": 0,
  "transport_route_id": null
}
```

---

## Example Scenarios

### Scenario 1: Different Fees for Different Routes
- **Route A (City Center):** ₹1500/month
- **Route B (Suburbs):** ₹1000/month
- **Route C (Highway):** ₹1200/month

Students are charged according to their assigned route.

### Scenario 2: Bulk Assignment
Use the endpoints in a loop to assign 50 students to North Route:
```bash
for student_id in 1..50:
  POST /api/students/{student_id}/transport
  {
    "transport_assigned": 1,
    "transport_route_id": 1
  }
```

### Scenario 3: Monthly Fee Report
To generate a report of transport fees payable:
```bash
GET /api/transport/students
# Shows all assigned students and their route fees
# Calculate: assigned_count × route_fee_amount = Total transport revenue
```

---

## Important Notes

1. ✅ **Transport fees apply ONLY to assigned students**
   - Unassigned students pay ₹0 transport fee

2. ✅ **Variable fees per route**
   - Each route can have a different fee amount
   - Change fee in route configuration, applies to all students on that route

3. ✅ **Active routes only**
   - Set route status to 'Inactive' to prevent new assignments
   - Existing students on inactive routes still pay the fee

4. ✅ **Safe unassignment**
   - Setting `transport_assigned = 0` automatically clears `transport_route_id`
   - Student will not be charged transport fee

---

## Testing with cURL

```bash
# Get all routes
curl -X GET "http://localhost:5000/api/transport/routes"

# Create a new route
curl -X POST "http://localhost:5000/api/transport/routes" \
  -H "Content-Type: application/json" \
  -d '{
    "route_name": "East Route",
    "fee_amount": 1300,
    "destination": "East Gate",
    "vehicle_id": "ER-01"
  }'

# Assign student to transport
curl -X POST "http://localhost:5000/api/students/5/transport" \
  -H "Content-Type: application/json" \
  -d '{"transport_assigned": 1, "transport_route_id": 1}'

# Get student transport fee
curl -X GET "http://localhost:5000/api/students/5/transport-fee"

# Get all students by transport status
curl -X GET "http://localhost:5000/api/transport/students"
```

---

## Database Query Examples

### Find students assigned to North Route
```sql
SELECT s.id, s.roll_no, s.name, tr.route_name, tr.fee_amount
FROM students s
JOIN transport_routes tr ON s.transport_route_id = tr.id
WHERE s.transport_assigned = 1 AND tr.route_name = 'North Route'
ORDER BY s.name;
```

### Calculate total transport revenue
```sql
SELECT 
  tr.route_name,
  COUNT(s.id) as student_count,
  tr.fee_amount,
  COUNT(s.id) * tr.fee_amount as total_monthly_fee
FROM transport_routes tr
LEFT JOIN students s ON s.transport_route_id = tr.id AND s.transport_assigned = 1
WHERE tr.status = 'Active'
GROUP BY tr.id
ORDER BY total_monthly_fee DESC;
```

### Find students without transport
```sql
SELECT id, roll_no, name, class_name
FROM students
WHERE transport_assigned = 0
ORDER BY class_name, name;
```

---

## Summary

✅ **Created:**
- `transport_routes` table with route management
- `transport_assigned` and `transport_route_id` columns in students table
- 6 API endpoints for complete transport management
- Conditional fee logic (fee only charged if assigned)
- Variable fee amounts per route

✅ **Ready to use:**
- Create routes with different fees
- Assign students to routes
- Query transport assignments
- Calculate transport revenue
- Get per-student transport fees
