(() => {
  'use strict';
  const form = document.getElementById('contactForm');
  if (!form) return;

  const email = 'vnaturedesign@mail.ru';
  const status = document.getElementById('contactFormStatus');
  const draft = document.getElementById('contactDraft');
  const draftText = document.getElementById('contactDraftText');

  async function copyText(text, feedback, success, fallback) {
    try {
      await navigator.clipboard.writeText(text);
      feedback.textContent = success;
    } catch {
      feedback.textContent = fallback;
      if (feedback === status) {
        draftText.focus();
        draftText.select();
      }
    }
  }

  document.getElementById('copyEmail').addEventListener('click', () => {
    copyText(email, document.getElementById('copyEmailStatus'),
      'Почта скопирована.', 'Выдели и скопируй адрес почты выше.');
  });
  document.getElementById('copyBrief').addEventListener('click', () => {
    copyText(draftText.value, status, 'Заявка скопирована. Отправь её на ' + email,
      'Текст выделен — скопируй его и отправь на ' + email);
  });

  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const get = name => String(data.get(name) || '').trim();
    const subject = `Новый проект VNATURE — ${get('name')}`;
    const body = [
      `Имя: ${get('name')}`, `Контакт: ${get('contact')}`,
      `Бюджет: ${get('budget') || 'Не определён'}`, '', 'Задача:', get('project')
    ].join('\n');
    draftText.value = `${subject}\n\n${body}`;
    draft.hidden = false;
    status.textContent = 'Открываем почтовое приложение. Если оно не открылось, скопируй заявку выше. Письмо нужно отправить самостоятельно.';
    window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });
})();
