# Restock API Documentation
**Version:** 1.0.0
**Base URL:** `http://localhost:3000` (dev) / `https://your-domain.com` (prod)
**Built with:** NestJS + MongoDB + Cloudinary + Google Vision

---

## AUTHENTICATION

All protected endpoints require a Bearer token in the request header:
```
Authorization: Bearer <accessToken>
```

Access tokens expire in **15 minutes**. Use the refresh token to get a new one.

---

## 1. AUTH ENDPOINTS

### POST `/auth/signup`
Register a new user.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "fullName": "John Doe"
}
```

**Response `201`:**
```json
{
  "accessToken": "eyJhbGci...",
  "refreshToken": "eyJhbGci...",
  "user": {
    "id": "6a36f54f30cf619d33fe9b73",
    "email": "user@example.com"
  }
}
```

**Errors:**
| Code | Message |
|------|---------|
| 409 | Email already registered |
| 400 | Validation error (missing/invalid fields) |

---

### POST `/auth/login`
Authenticate an existing user.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response `200`:**
```json
{
  "accessToken": "eyJhbGci...",
  "refreshToken": "eyJhbGci...",
  "user": {
    "id": "6a36f54f30cf619d33fe9b73",
    "email": "user@example.com"
  }
}
```

**Errors:**
| Code | Message |
|------|---------|
| 401 | Invalid credentials |

---

### POST `/auth/refresh`
Get a new access token using a refresh token.

**Request Body:**
```json
{
  "refreshToken": "eyJhbGci..."
}
```

**Response `200`:**
```json
{
  "accessToken": "eyJhbGci...",
  "refreshToken": "eyJhbGci...",
  "user": {
    "id": "6a36f54f30cf619d33fe9b73",
    "email": "user@example.com"
  }
}
```

**Errors:**
| Code | Message |
|------|---------|
| 401 | Invalid refresh token |

---

### POST `/auth/logout` 🔒
Log out the current user. Invalidates the refresh token.

**Response `200`:**
```json
{
  "message": "Logged out successfully"
}
```

---

## 2. USER PROFILE ENDPOINTS 🔒

### GET `/users/me`
Get the current user's profile.

**Response `200`:**
```json
{
  "_id": "6a36f54f30cf619d33fe9b73",
  "email": "user@example.com",
  "fullName": "John Doe",
  "isActive": true,
  "createdAt": "2026-06-21T18:16:19.659Z",
  "updatedAt": "2026-06-21T18:16:19.659Z"
}
```

> Note: `password` and `refreshToken` are never returned.

---

### PATCH `/users/me`
Update the current user's profile.

**Request Body (all fields optional):**
```json
{
  "fullName": "Lukman Abdulrauf"
}
```

**Response `200`:** Updated user object (same shape as GET `/users/me`)

---

### PATCH `/users/me/change-password`
Change the current user's password.

**Request Body:**
```json
{
  "currentPassword": "oldpassword123",
  "newPassword": "newpassword456"
}
```

**Response `200`:**
```json
{
  "message": "Password changed successfully"
}
```

**Errors:**
| Code | Message |
|------|---------|
| 401 | Current password is incorrect |

---

### DELETE `/users/me`
Permanently delete the current user's account.

**Response `200`:**
```json
{
  "message": "Account deleted successfully"
}
```

> ⚠️ This is irreversible. Show a confirmation dialog before calling this.

---

## 3. UPLOAD ENDPOINTS 🔒

### POST `/upload/receipt-image`
Upload a receipt image to cloud storage.

**Request:** `multipart/form-data`
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `file` | File | ✅ | JPEG, PNG, JPG, WEBP only. Max 10MB. |

**Response `201`:**
```json
{
  "publicId": "receipts/abc123xyz",
  "url": "https://res.cloudinary.com/your_cloud/image/upload/receipts/abc123xyz.jpg"
}
```

**Errors:**
| Code | Message |
|------|---------|
| 400 | No file uploaded |
| 400 | Only image files are allowed |

> **Mobile implementation note:** Use `FormData` to send the image. The `url` and `publicId` from this response are passed directly to `POST /receipts`.

---

## 4. RECEIPTS ENDPOINTS 🔒

### POST `/receipts`
Create a new receipt record. Automatically triggers OCR processing in the background.

**Request Body:**
```json
{
  "imageUrl": "https://res.cloudinary.com/...",
  "imagePublicId": "receipts/abc123xyz"
}
```

**Response `201`:**
```json
{
  "_id": "6a3912b2d66aa2668118f16a",
  "userId": "6a36f54f30cf619d33fe9b73",
  "imageUrl": "https://res.cloudinary.com/...",
  "imagePublicId": "receipts/abc123xyz",
  "status": "pending",
  "items": [],
  "createdAt": "2026-06-22T10:47:14.483Z",
  "updatedAt": "2026-06-22T10:47:14.483Z"
}
```

> **Important:** The response returns immediately with `status: "pending"`. OCR runs in the background (2-5 seconds). Poll `GET /receipts/:id` after a short delay to get the populated data.

**Receipt Status Flow:**
```
pending → processed   (OCR succeeded)
pending → failed      (OCR failed)
processed → manually_edited  (user edited the data)
failed → pending      (user triggered reprocess)
```

---

### GET `/receipts`
Get all receipts for the current user. Paginated.

**Query Parameters:**
| Param | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `page` | number | ❌ | 1 | Page number |
| `limit` | number | ❌ | 20 | Items per page |
| `status` | string | ❌ | all | Filter by status: `pending`, `processed`, `failed`, `manually_edited` |

**Example:** `GET /receipts?page=1&limit=10&status=processed`

**Response `200`:**
```json
{
  "data": [
    {
      "_id": "6a3912b2d66aa2668118f16a",
      "userId": "6a36f54f30cf619d33fe9b73",
      "imageUrl": "https://res.cloudinary.com/...",
      "imagePublicId": "receipts/abc123xyz",
      "status": "processed",
      "vendorName": "Green Supermarket",
      "totalAmount": 27.35,
      "currency": "USD",
      "purchaseDate": "2026-06-20T00:00:00.000Z",
      "items": [
        {
          "name": "APPLE",
          "quantity": 2,
          "totalPrice": 1.00
        }
      ],
      "ocrConfidence": 0.8,
      "createdAt": "2026-06-22T10:47:14.483Z",
      "updatedAt": "2026-06-22T10:47:15.771Z"
    }
  ],
  "meta": {
    "total": 8,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

---

### GET `/receipts/:id`
Get a single receipt by ID.

**Response `200`:** Single receipt object (same shape as items in the list above)

**Errors:**
| Code | Message |
|------|---------|
| 404 | Receipt not found |
| 403 | Access denied |

---

### PATCH `/receipts/:id`
Update a receipt manually. Sets status to `manually_edited`.

**Request Body (all fields optional):**
```json
{
  "vendorName": "Green Supermarket",
  "totalAmount": 27.35,
  "currency": "USD",
  "purchaseDate": "2026-06-20",
  "items": [
    {
      "name": "APPLE",
      "quantity": 2,
      "unitPrice": 0.50,
      "totalPrice": 1.00
    }
  ]
}
```

**Response `200`:** Updated receipt object

---

### DELETE `/receipts/:id`
Delete a receipt permanently.

**Response `200`:**
```json
{
  "message": "Receipt deleted successfully"
}
```

---

### POST `/receipts/:id/reprocess`
Re-trigger OCR on a receipt (useful for `failed` receipts).

**Response `200`:** Receipt object with `status: "pending"` (OCR runs in background)

---

## 5. DASHBOARD ENDPOINTS 🔒

### GET `/dashboard`
Get spending summary and statistics for the current user.

**Query Parameters:**
| Param | Type | Required | Notes |
|-------|------|----------|-------|
| `year` | number | ❌ | Defaults to current year |
| `month` | number | ❌ | 1–12. If provided, filters to that month only |
| `currency` | string | ❌ | Filter by currency code |

**Examples:**
```
GET /dashboard
GET /dashboard?year=2026
GET /dashboard?year=2026&month=6
```

**Response `200`:**
```json
{
  "overview": {
    "totalSpend": 176.60,
    "receiptCount": 4,
    "avgPerReceipt": 44.15,
    "totalItems": 12
  },
  "monthlyBreakdown": {
    "year": 2026,
    "months": [
      { "month": 1, "monthName": "Jan", "totalSpend": 0, "receiptCount": 0 },
      { "month": 6, "monthName": "Jun", "totalSpend": 176.60, "receiptCount": 4 }
    ]
  },
  "topVendors": [
    {
      "vendorName": "Green Supermarket",
      "totalSpend": 54.70,
      "visitCount": 2,
      "avgSpend": 27.35
    }
  ],
  "spendingByCategory": [
    {
      "itemName": "MILK",
      "totalSpend": 3.00,
      "timesOrdered": 2
    }
  ],
  "recentReceipts": [
    {
      "_id": "6a3912b2d66aa2668118f16a",
      "vendorName": "Green Supermarket",
      "totalAmount": 27.35,
      "currency": "USD",
      "status": "processed",
      "purchaseDate": "2026-06-20T00:00:00.000Z",
      "createdAt": "2026-06-22T10:47:14.483Z",
      "imageUrl": "https://res.cloudinary.com/..."
    }
  ],
  "statusBreakdown": {
    "pending": 0,
    "processed": 3,
    "failed": 1,
    "manually_edited": 1
  }
}
```

> **Note:** Dashboard only counts receipts with status `processed` or `manually_edited`. `pending` and `failed` receipts are excluded from spend calculations.

---

## 6. EXPORT ENDPOINTS 🔒

### GET `/export/receipts/csv`
Export receipts as a CSV file. Format is compatible with QuickBooks, Xero, Wave, Zoho, Excel, and Google Sheets.

**Query Parameters:**
| Param | Type | Required | Notes |
|-------|------|----------|-------|
| `startDate` | ISO date string | ❌ | e.g. `2026-01-01` |
| `endDate` | ISO date string | ❌ | e.g. `2026-12-31` |
| `status` | string | ❌ | `pending`, `processed`, `failed`, `manually_edited` |

**Examples:**
```
GET /export/receipts/csv
GET /export/receipts/csv?startDate=2026-01-01&endDate=2026-12-31
GET /export/receipts/csv?status=processed
GET /export/receipts/csv?startDate=2026-06-01&endDate=2026-06-30&status=processed
```

**Response:** Binary CSV file download

**CSV Columns:**
| Column | Description |
|--------|-------------|
| Receipt ID | MongoDB document ID |
| Date | Purchase date (YYYY-MM-DD) |
| Vendor | Store/vendor name |
| Item Name | Individual line item name |
| Quantity | Units purchased |
| Unit Price | Price per unit |
| Item Total | Line item total |
| Receipt Total | Full receipt total |
| Currency | Currency code (USD, NGN, SAR, etc.) |
| Status | Receipt status |
| Scanned On | Date the receipt was scanned |

> **Note:** One row per line item. If a receipt has 5 items, it produces 5 rows — all sharing the same Receipt ID, Date, Vendor, and Receipt Total.

**Errors:**
| Code | Message |
|------|---------|
| 404 | No receipts found matching the selected filters |

---

## MOBILE IMPLEMENTATION GUIDE

### Recommended scan-to-save flow

```
1. User taps "Scan Receipt"
2. Camera opens → user takes photo
3. App calls POST /upload/receipt-image (multipart/form-data)
4. On success → immediately call POST /receipts with imageUrl + imagePublicId
5. Show loading state: "Processing your receipt..."
6. Poll GET /receipts/:id every 2 seconds
7. When status changes from "pending" to "processed" or "failed" → stop polling
8. If "processed" → show extracted data for user review
9. If "failed" → show error with "Try Again" button (calls POST /receipts/:id/reprocess)
10. User can edit any field → PATCH /receipts/:id
```

### Token management

```
- Store both accessToken and refreshToken securely (Keychain on iOS, Keystore on Android)
- accessToken expires in 15 minutes
- On any 401 response → call POST /auth/refresh with the refreshToken
- If refresh also returns 401 → session expired, redirect to login
- On logout → call POST /auth/logout then clear both tokens from storage
```

### Error handling

All errors follow this shape:
```json
{
  "statusCode": 400,
  "message": "Validation error message here",
  "error": "Bad Request"
}
```

For validation errors, `message` may be an array:
```json
{
  "statusCode": 400,
  "message": ["email must be an email", "password must be longer than 6 characters"],
  "error": "Bad Request"
}
```

---

## ENDPOINT SUMMARY

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/signup` | ❌ | Register |
| POST | `/auth/login` | ❌ | Login |
| POST | `/auth/refresh` | ❌ | Refresh tokens |
| POST | `/auth/logout` | ✅ | Logout |
| GET | `/users/me` | ✅ | Get profile |
| PATCH | `/users/me` | ✅ | Update profile |
| PATCH | `/users/me/change-password` | ✅ | Change password |
| DELETE | `/users/me` | ✅ | Delete account |
| POST | `/upload/receipt-image` | ✅ | Upload image |
| POST | `/receipts` | ✅ | Create receipt |
| GET | `/receipts` | ✅ | List receipts |
| GET | `/receipts/:id` | ✅ | Get receipt |
| PATCH | `/receipts/:id` | ✅ | Edit receipt |
| DELETE | `/receipts/:id` | ✅ | Delete receipt |
| POST | `/receipts/:id/reprocess` | ✅ | Retry OCR |
| GET | `/dashboard` | ✅ | Get stats |
| GET | `/export/receipts/csv` | ✅ | Export CSV |

---

*Generated by LUXA Studio | Restock Backend v1.0.0 | June 2026*
