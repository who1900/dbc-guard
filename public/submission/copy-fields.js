for (const field of document.querySelectorAll('input,textarea')) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Copy field';
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(field.value);
      button.textContent = 'Copied';
    } catch {
      field.focus();
      field.select();
      button.textContent = 'Selected — copy manually';
    }
  });
  field.after(button);
}
