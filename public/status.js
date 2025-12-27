document.getElementById('statusForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const id = document.getElementById('refId').value.trim();
  if(!id) return;
  await check(id);
});

async function check(id){
  const resEl = document.getElementById('statusResult');
  resEl.style.display = 'block';
  resEl.innerText = 'Checking...';
  try{
    const res = await fetch(`/status/${encodeURIComponent(id)}`);
    if(!res.ok){
      const err = await res.json();
      resEl.innerText = err.error || 'Not found';
      return;
    }
    const data = await res.json();
    resEl.innerHTML = `<strong>Reference:</strong> ${data.referenceId}<br>
      <strong>Issue:</strong> ${data.issueType}<br>
      <strong>Location:</strong> ${data.city}, ${data.area}, ${data.street}<br>
      <strong>Status:</strong> ${data.status || 'Received'}<br>
      <strong>Submitted:</strong> ${new Date(data.date).toLocaleString()}<br>
      <p style="margin-top:8px">Description: ${data.description}</p>`;
  }catch(err){
    resEl.innerText = 'Network error';
  }
}

// If ?id= in URL, auto-check
const params = new URLSearchParams(window.location.search);
if(params.get('id')){
  document.getElementById('refId').value = params.get('id');
  check(params.get('id'));
}
