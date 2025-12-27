const express = require("express");
const fs = require("fs");
const nodemailer = require("nodemailer");
const { v4: uuidv4 } = require("uuid");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(express.static("public"));

// Ensure complaints.json exists
const complaintsFile = "complaints.json";
if (!fs.existsSync(complaintsFile)) {
  fs.writeFileSync(complaintsFile, JSON.stringify([], null, 2));
}

// Verify Google Token endpoint
app.post("/verify-google-token", async (req, res) => {
  const token = req.body.token;
  
  if (!token) {
    return res.status(400).json({ valid: false, error: "No token provided" });
  }
  
  try {
    // Decode and verify Google JWT (without backend verification for simplicity)
    // In production, verify with Google's OAuth API
    const parts = token.split('.');
    if (parts.length !== 3) {
      return res.status(401).json({ valid: false, error: "Invalid token format" });
    }
    
    const decoded = JSON.parse(Buffer.from(parts[1], 'base64'));
    
    // Check token expiration
    if (decoded.exp && decoded.exp < Date.now() / 1000) {
      return res.status(401).json({ valid: false, error: "Token expired" });
    }
    
    res.json({ valid: true, email: decoded.email });
  } catch (err) {
    console.error('Token verification error:', err);
    res.status(401).json({ valid: false, error: "Token verification failed" });
  }
});

app.post("/submit-complaint", async (req, res) => {
  // Verify Google token before processing
  if (!req.body.googleToken) {
    return res.status(401).json({ error: "Google authentication required" });
  }
  
  try {
    const parts = req.body.googleToken.split('.');
    const decoded = JSON.parse(Buffer.from(parts[1], 'base64'));
    
    if (!decoded.email) {
      return res.status(401).json({ error: "Invalid Google token" });
    }
  } catch (err) {
    return res.status(401).json({ error: "Token verification failed" });
  }

  const referenceId = "VLG-" + uuidv4().slice(0, 8);

  const complaint = {
    referenceId,
    ...req.body,
    date: new Date(),
    status: "Received"
  };

  // Store complaint
  const data = JSON.parse(fs.readFileSync(complaintsFile));
  // handle optional image (base64)
  if(req.body.imageData){
    const saved = saveImage(req.body.imageData, referenceId);
    if(saved) complaint.imagePath = saved;
  }
  data.push(complaint);
  fs.writeFileSync(complaintsFile, JSON.stringify(data, null, 2));

  // Email setup with Google Gmail
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD
    }
  });

  const mailOptions = {
    from: process.env.GMAIL_USER,
    to: req.body.email,
    subject: "Complaint Registered Successfully - Reference ID: " + referenceId,
    html: `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%); padding: 20px; text-align: center; color: white; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0; font-size: 24px;">Complaint Registered Successfully</h2>
      </div>
      <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e0e0e0;">
        <p>Dear Citizen,</p>
        <p>Thank you for reporting this issue. Your complaint has been successfully registered in our system.</p>
        
        <div style="background: white; padding: 20px; border-left: 4px solid #3b82f6; margin: 20px 0; border-radius: 4px;">
          <h3 style="color: #3b82f6; margin-top: 0;">Your Reference ID:</h3>
          <p style="font-size: 18px; font-weight: bold; color: #000; word-break: break-all;">${referenceId}</p>
          <p style="color: #666; font-size: 12px; margin: 10px 0 0 0;">Keep this reference ID for tracking your complaint status.</p>
        </div>
        
        <h3 style="color: #333; margin-top: 20px;">Complaint Details:</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr style="background: #f0f0f0;">
            <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Issue Type:</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${req.body.issueType}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Location:</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${req.body.street}, ${req.body.area}, ${req.body.city}</td>
          </tr>
          <tr style="background: #f0f0f0;">
            <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Description:</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${req.body.description}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Submitted On:</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${new Date().toLocaleString()}</td>
          </tr>
        </table>
        
        <h3 style="color: #333; margin-top: 20px;">Next Steps:</h3>
        <ol style="color: #666;">
          <li>Your complaint has been recorded and assigned a reference ID</li>
          <li>Our team will review your complaint within 24-48 hours</li>
          <li>You can track the status anytime using your reference ID</li>
          <li>You will receive email updates as your complaint is processed</li>
        </ol>
        
        <p style="color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 20px;">
          This is an automated email. Please do not reply to this email. For further assistance, visit our website or contact support.
        </p>
      </div>
      <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
        <p>© 2025 Local Government Authority | All rights reserved</p>
      </div>
    </div>
    `
  };

  let emailSent = false;
  try{
    if(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD){
      await transporter.sendMail(mailOptions);
      emailSent = true;
      console.log('Email sent successfully to', req.body.email);
    }else{
      console.warn('GMAIL_USER or GMAIL_APP_PASSWORD not set; email not sent');
    }
  }catch(err){
    console.error('Failed to send email:', err);
  }

  res.json({
    message: `Complaint submitted successfully. Reference ID: ${referenceId}${emailSent ? ' - Confirmation email sent.' : ''}`,
    referenceId,
    emailSent
  });
});

// Check status by reference id
app.get('/status/:id', (req, res) => {
  const id = req.params.id;
  const data = JSON.parse(fs.readFileSync(complaintsFile));
  const found = data.find(c => c.referenceId === id);
  if(!found) return res.status(404).json({ error: 'Reference not found' });
  res.json(found);
});

// Admin info (do NOT expose sensitive credentials)
app.get('/admin-info', (req, res) => {
  const email = process.env.GMAIL_USER || null;
  const masked = email ? (email[0] + '***' + email.slice(-10)) : null;
  res.json({ email: masked, configured: !!email });
});

// Ensure uploads directory exists
const uploadsDir = "uploads";
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

// Accept base64 image in complaint and save to uploads/<referenceId>.*
function saveImage(base64Data, referenceId){
  try{
    const matches = base64Data.match(/^data:(image\/\w+);base64,(.+)$/);
    if(!matches) return null;
    const ext = matches[1].split('/')[1];
    const data = matches[2];
    const filename = `${referenceId}.${ext}`;
    const filepath = `${uploadsDir}/${filename}`;
    fs.writeFileSync(filepath, Buffer.from(data, 'base64'));
    return filepath;
  }catch(e){
    console.error('saveImage error', e);
    return null;
  }
}

app.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});
