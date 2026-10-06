<script>
 let country='US',postal='',result='';
 const renamed=new URLSearchParams(location.search).has('renamed');
 async function submit(event){event.preventDefault();await new Promise(resolve=>setTimeout(resolve,120));result=country==='CA'?'Tax service unavailable':'Order summary is visible';}
</script>
<main><h1>Svelte checkout</h1><form onsubmit={submit}>
<label for="country">Country</label><select id="country" data-testid="country" bind:value={country}><option value="US">United States</option><option value="CA">Canada</option></select>
<label for="postal">Postal code</label><input id="postal" data-testid="postal" bind:value={postal} required/>
<button type="submit">{renamed?'Review order':'Continue'}</button><p role="status">{result}</p>
</form></main>
