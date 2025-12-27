// Firebase Auth state
let googleToken = null;
let googleUser = null;

// Sign in with Firebase Google popup
async function signInWithGoogle() {
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    const result = await firebase.auth().signInWithPopup(provider);
    const user = result.user;
    googleUser = { email: user.email, name: user.displayName, picture: user.photoURL };
    googleToken = await user.getIdToken();
    onAuthSuccess();
  } catch (err) {
    console.error('Firebase sign-in error', err);
    const msg = (err && (err.code || err.message)) ? `${err.code || ''} ${err.message || ''}`.trim() : 'Google sign-in failed';
    showToast(msg, { error: true });
    const dbg = document.getElementById('authDebug');
    if(dbg){ dbg.style.display = ''; dbg.innerText = 'Sign-in error: ' + msg; }
  }
}

async function signOutGoogle() {
  try {
    await firebase.auth().signOut();
  } catch (e) { console.warn(e); }
  googleToken = null;
  googleUser = null;
  document.getElementById('googleLoginSection').style.display = '';
  document.getElementById('formSection').style.display = 'none';
  document.getElementById('userInfo').style.display = 'none';
  document.getElementById('signOutBtn').style.display = 'none';
}

function onAuthSuccess(){
  document.getElementById('googleLoginSection').style.display = 'none';
  document.getElementById('formSection').style.display = 'block';
  document.getElementById('userName').innerText = googleUser.name || googleUser.email;
  document.getElementById('userInfo').style.display = 'block';
  document.getElementById('signOutBtn').style.display = '';
  document.getElementById('email').value = googleUser.email || '';
  // Optionally verify token with backend
  verifyGoogleToken(googleToken);
}

// Verify token with backend (basic check)
async function verifyGoogleToken(token){
  try{
    const res = await fetch('/verify-google-token', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ token }) });
    const j = await res.json();
    if(!j.valid){ showToast('Token verification failed', { error: true }); signOutGoogle(); }
  }catch(e){ console.warn('verify token error', e); }
}

// Wire sign-in/out buttons
document.addEventListener('DOMContentLoaded', ()=>{
  const signInBtn = document.getElementById('signInBtn');
  const signOutBtn = document.getElementById('signOutBtn');
  if(signInBtn) signInBtn.addEventListener('click', signInWithGoogle);
  if(signOutBtn) signOutBtn.addEventListener('click', signOutGoogle);
  // Listen to auth state changes
  if(typeof firebase !== 'undefined' && firebase.auth){
    firebase.auth().onAuthStateChanged(async (user)=>{
      if(user){
        googleUser = { email: user.email, name: user.displayName, picture: user.photoURL };
        googleToken = await user.getIdToken();
        onAuthSuccess();
      } else {
        // not signed in
      }
    });
  }
});

document.getElementById("issueForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  
  // Check if user is logged in
  if (!googleToken) {
    showToast('Please sign in with Google first.', 'error');
    return;
  }
  
  const form = document.getElementById('issueForm');
  if(!form.checkValidity()){
    form.reportValidity();
    return;
  }

  const data = {
    city: document.getElementById('city').value,
    area: document.getElementById('area').value,
    street: document.getElementById('street').value,
    issueType: document.getElementById('issueType').value,
    otherIssue: (document.getElementById('otherIssue') && document.getElementById('otherIssue').value) || '',
    description: document.getElementById('description').value,
    email: document.getElementById('email').value,
    googleToken: googleToken
  };

  // if photo exists, convert to base64 and include
  const photoInputEl = document.getElementById('photo');
  if(photoInputEl && photoInputEl.files && photoInputEl.files[0]){
    const file = photoInputEl.files[0];
    const reader = new FileReader();
    const base64 = await new Promise((resolve, reject)=>{
      reader.onload = ()=> resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    data.imageData = base64;
  }

  try{
    // disable submit and show spinner
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.classList.add('loading');
    submitBtn.disabled = true;

    const res = await fetch('/submit-complaint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const result = await res.json();
    const msg = document.getElementById('message');
    if(res.ok){
      msg.innerText = result.message;
      const ref = result.referenceId || (result.message && result.message.match(/Reference ID: (\S+)/)?.[1]);
      const action = ref ? { text: 'View / Manage', handler: () => { showStatusSection(); document.getElementById('refId').value = ref; check(ref); } } : null;
      // Save a copy to Firestore (optional) if Firebase is initialized
      if (typeof db !== 'undefined' && ref) {
        try {
          saveToFirestore({ ...data, referenceId: ref });
        } catch (e) {
          console.warn('Failed to save to Firestore', e);
        }
      }
      
      // Show success toast with email confirmation
      let toastMsg = result.message;
      if(result.emailSent) {
        toastMsg += ' ✓ Confirmation email sent!';
      }
      showToast(toastMsg, { action });
      
      // show modal with reference id and email confirmation
      if(ref){
        const modal = document.getElementById('successModal');
        const modalMsg = document.getElementById('modalMessage');
        const emailStatus = result.emailSent 
          ? `<div style="margin-top:12px;padding:12px;background:rgba(34,197,94,0.1);border-left:3px solid #22c55e;border-radius:4px;color:#22c55e;font-size:13px;">✓ Confirmation email sent to <strong>${data.email}</strong></div>`
          : '';
        modalMsg.innerHTML = `Reference ID: <strong>${ref}</strong>${emailStatus}`;
        modal.dataset.ref = ref;
        modal.classList.add('show');
        modal.setAttribute('aria-hidden','false');
      }
      document.getElementById('issueForm').reset();
    } else {
      const errText = result.error || 'Submission failed';
      msg.innerText = errText;
      showToast(errText, { error: true });
    }
  }catch(err){
    document.getElementById('message').innerText = 'Network error';
    showToast('Network error', { error: true });
    console.error(err);
  } finally {
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.classList.remove('loading');
    submitBtn.disabled = false;
  }
});

  // Save document to Firestore (client-side)
  async function saveToFirestore(doc){
    if (typeof db === 'undefined') return;
    try{
      await db.collection('complaints').add({
        ...doc,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      console.log('Saved complaint to Firestore');
    }catch(e){
      console.error('Firestore save error', e);
    }
  }

// show/hide "Other" input when issue type changes
const issueSelect = document.getElementById('issueType');
if(issueSelect){
  issueSelect.addEventListener('change', (e)=>{
    const otherField = document.getElementById('otherField');
    if(!otherField) return;
    otherField.style.display = e.target.value === 'Other' ? '' : 'none';
  });
}

// wizard navigation and photo preview
const wizard = document.querySelectorAll('.wizard-step');
let currentStep = 1;
function showStep(n){
  wizard.forEach(s=> s.style.display = s.dataset.step==n ? '' : 'none');
  document.querySelectorAll('.step').forEach(el=> el.classList.toggle('active', el.dataset.step==n));
  currentStep = Number(n);
}

document.querySelectorAll('[data-action="next"]').forEach(btn=> btn.addEventListener('click', ()=>{
  if(currentStep < wizard.length) showStep(currentStep+1);
}));
document.querySelectorAll('[data-action="back"]').forEach(btn=> btn.addEventListener('click', ()=>{
  if(currentStep > 1) showStep(currentStep-1);
}));

const photoInput = document.getElementById('photo');
if(photoInput){
  photoInput.addEventListener('change', ()=>{
    const file = photoInput.files[0];
    const preview = document.getElementById('photoPreview');
    preview.innerHTML = '';
    if(!file) return;
    const img = document.createElement('img');
    img.alt = 'Preview';
    img.src = URL.createObjectURL(file);
    preview.appendChild(img);
  });
}

/* ----- Status checking & UI toggle ----- */
const reportSection = document.getElementById('reportSection');
const statusSection = document.getElementById('statusSection');
const statusResultEl = document.getElementById('statusResult');

document.getElementById('showReport').addEventListener('click', ()=>{
  reportSection.style.display = '';
  statusSection.style.display = 'none';
  setActiveTab('report');
});
document.getElementById('showStatus').addEventListener('click', ()=>{
  showStatusSection();
  setActiveTab('status');
});

function showStatusSection(){
  reportSection.style.display = 'none';
  statusSection.style.display = '';
}

function setActiveTab(tab){
  const r = document.getElementById('showReport');
  const s = document.getElementById('showStatus');
  if(tab === 'report'){ r.classList.add('active'); s.classList.remove('active'); }
  else { s.classList.add('active'); r.classList.remove('active'); }
}

document.getElementById('statusForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const id = document.getElementById('refId').value.trim();
  if(!id) return;
  await check(id);
});

async function check(id){
  statusResultEl.style.display = 'block';
  statusResultEl.innerText = '';
  // add loading shimmer
  statusResultEl.classList.add('loading');
  statusResultEl.innerHTML = '<div style="height:60px"></div>';
  try{
    const res = await fetch(`/status/${encodeURIComponent(id)}`);
    if(!res.ok){
      const err = await res.json();
      statusResultEl.classList.remove('loading');
      statusResultEl.innerText = err.error || 'Not found';
      return;
    }
    const data = await res.json();
    statusResultEl.classList.remove('loading');
    statusResultEl.innerHTML = `<strong>Reference:</strong> ${data.referenceId}<br>
      <strong>Issue:</strong> ${data.issueType}${data.otherIssue? ' — '+data.otherIssue : ''}<br>
      <strong>Location:</strong> ${data.city}, ${data.area}, ${data.street}<br>
      <strong>Status:</strong> ${data.status || 'Received'}<br>
      <strong>Submitted:</strong> ${new Date(data.date).toLocaleString()}<br>
      <p style="margin-top:8px">Description: ${data.description}</p>`;
  }catch(err){
    statusResultEl.classList.remove('loading');
    statusResultEl.innerText = 'Network error';
  }
}

// Auto-open status if ?id= in URL
const params = new URLSearchParams(window.location.search);
if(params.get('id')){
  const id = params.get('id');
  showStatusSection();
  document.getElementById('refId').value = id;
  check(id);
}

// initialize tab active state
setActiveTab(params.get('id') ? 'status' : 'report');

function showToast(text, opts = {}){
  const t = document.getElementById('toast');
  if(!t) return;
  t.className = 'toast';
  if(opts.error) t.classList.add('error');
  t.innerHTML = `<span>${text}</span>`;
  if(opts.action){
    const a = document.createElement('span');
    a.className = 'action';
    a.innerText = opts.action.text || 'Action';
    a.onclick = opts.action.handler || (()=>{});
    t.appendChild(a);
  }
  // show
  requestAnimationFrame(()=> t.classList.add('show'));
  if(t._hideTimeout) clearTimeout(t._hideTimeout);
  t._hideTimeout = setTimeout(()=>{ t.classList.remove('show'); }, 7000);
}

// modal copy and close handlers
const copyBtn = document.getElementById('copyRef');
const closeBtn = document.getElementById('closeModal');
const modalEl = document.getElementById('successModal');
if(copyBtn){
  copyBtn.addEventListener('click', async ()=>{
    const ref = modalEl && modalEl.dataset.ref;
    if(!ref) return;
    try{
      await navigator.clipboard.writeText(ref);
      showToast('Reference copied to clipboard');
    }catch(e){
      showToast('Copy failed', { error: true });
    }
  });
}
if(closeBtn){
  closeBtn.addEventListener('click', ()=>{
    modalEl.classList.remove('show');
    modalEl.setAttribute('aria-hidden','true');
  });
}
/* Legacy Firebase redirect login code (React style) - disabled in this vanilla JS app.
import { signInWithRedirect, getRedirectResult } from "firebase/auth";

const login = () => {
  signInWithRedirect(auth, provider);
};

useEffect(() => {
  getRedirectResult(auth)
    .then((result) => {
      if (result) console.log(result.user);
    })
    .catch(console.error);
}, []);
import { signInWithRedirect, getRedirectResult } from "firebase/auth";

const login = () => {
  signInWithRedirect(auth, provider);
};

useEffect(() => {
  getRedirectResult(auth)
    .then((result) => {
      if (result) console.log(result.user);
    })
    .catch(console.error);
}, []);
*/



