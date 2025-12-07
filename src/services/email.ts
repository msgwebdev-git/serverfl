import { Resend } from 'resend';
import { config } from '../config/index.js';
import type { Order, OrderItem } from '../types/index.js';

const resend = new Resend(config.email.resendApiKey);

// Base64 encoded PNG icons (24x24, orange #DC5722)
const icons = {
  // Prohibition circle with X
  noEntry: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAACXBIWXMAAAsTAAALEwEAmpwYAAABUklEQVR4nO2UP0sDQRDFf4mFYGEhWFgIFhaCRbCwsLC0tLG0tLTx0wgWFoKFYGEhWFgIFoKFYCH4Z2Zv9+4ucodzl5BsLoFDBg7ezO7svBl2YW9/9gvMAA3gCfgCPv3+BowDZ8At8DGovs8bMAkcAefAC/Dhq/NvYBI4AM6AZ+DVV9v3DYwBR8AJcOer7bkGRoED4Bi4Ah592cI5MAIcAAfAOXDjyxa0gRHfhX3gBLgGbmz5gQ4wDOwB+8ApcOvLDoZZwCCwC+wBZ8C9L1vQAgaBHWAXOAcefNlCC+gHtoFd4AJ49GULmkA/sAXsAJfAky9bWAf6gE1gG7gCnn3ZsqMO9AAbwDZwDTz7cuoFXaAb2AC2gBvg1ZdD39cJuoF1YAu4A9582cI60AG6gHXgAXj3lRB3gE7QBayBNKRr4MOXLZwBnUAXuM9Z/LJ/APTSIh4qhJVQAAAAAElFTkSuQmCC',
  // No fire icon
  noFire: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAACXBIWXMAAAsTAAALEwEAmpwYAAABhklEQVR4nO2Uv0oDQRDGf4mFYGEhWCQQSCBYWFhYWFpY+gYWPoGFhYWFhYWFoIWFYGEhWAQCCQQLCwvBIsHZmd27u8vcxUsukuQC+eFgd2f3m9n5dge29hezwCjQBTwCn0BXzG/AMHAEXAI/g+rzfAGTwD5wAjwBnyHTd2ACOAR6wDPwFir9+wZGgH2gBzwDb6HS/34DI8A+0AUugJdQ2YU20AX2gGPgCngNlV3oAN3ALnAMXAPvobILa6ALdIE94Ap4D5Vd6ABdYBfYBy6Aj1DZhVWgC+wAe8Al8BkqO7AMdIFtYA+4Br5CZReWgC7QAXaBG+A7VFawAHSBNrAL3AG/obIDC0AHaAO7wD3wFyq7MA90gDawA3QBHUK2xP8b0AZawC7QBXQI5f4EtIEWsAt0AR1Cuf8eaAMtYA/oAjqEyt/jINAGWsAB0AN0COX+baANNIFDoAfIL6g9e0AT2AIOgR4gfx/lvg2gCWwBR0APkP+hctcG0AS2gCOgB8j/U+Vu/QPDgyeORzIYOQAAAABJRU5ErkJggg==',
  // No climbing icon
  noClimb: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAACXBIWXMAAAsTAAALEwEAmpwYAAABfklEQVR4nO2UP0sDQRDFfxELwcJCsLAQLCwsLCwtLS0tLf00goWFYGEhWFgIFoKFYCFYCP7ZnZm9vUtyx3nJkUsOEhx4MLM7O29m/8De/u0XmAEmgVvgE/gU+xswChwDF8DXoPoibcA4cAycAY/Ah1jdPzAGHAI94Al4Dpn+dwuMAodAF3gCXkKm/90AI8Ah0AEugdeQ6f8N0AYOgGPgGngLmf7fAm3gADgGroD3kOn/LdAGDoAj4BJ4D5ntOQPawD5wBFwBH/4/gVlgAugAB8A18BkyR9ABJoB9oANcA18hcwRdYALYB46BG+A7ZI6gB0wAXeAIuAV+QuYI+sAEsA8cA3fAb8gcwQCYAPaBI+Ae+AuZ3s0QE8AO0AVugP+Qmft3gAlgGzgC7oH/kJn7D4AJYAM4Bu6B/5CZ+4+ACWAdOALugf+Q2e4TYAJYAzrAPfAfMrOPgAlgFTgC7oH/kJl9hEwAK0AHuAf+Q2bu3wEmgGWgA3SJlb+xfwHuFRvxeJAb6gAAAABJRU5ErkJggg==',
  // No tent icon
  noTent: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAACXBIWXMAAAsTAAALEwEAmpwYAAABYElEQVR4nO2UP07DQBCFP0KBREFBQUFBQUFBQQEFBaWlpaXlNBQUFBQUFBQUFEgUFBQUSPzZnfnZXTvOOpYTK5GdRIr0pNX8+c3sjg3s7N9mgQlgGrgFPoBP0d+BYeAQuAR+h9TnaQWGgCPgDHgEvkTr/gfGgCOgCzwBz6LT/26BceAI6AJPwIto3d8GxoEjoAM8Aq+idX8bGAeOgA7wALyJ1v1tYBw4AjrAPfAuWve3gXHgCOgAd8CH/05gFJgAOsAB8AC8+f8EpoAJoAPsA/fAa8gcQS8wAXSAfaALvIbMEfSBCWAf6AD3wFvIHMEgMAHsA13gHngPmSMYAiaAfeAYeAA+QuYIhoEJYB84Bh6Bz5A5ghFgAtgHjoEn4CtkjmAUmAD2gS7wDHyHzBGMAhPAPnAMPAPfIXMEY8AEsA90gRfgJ2SOYAyYAPaBI+AZ+A2Zuf8AGAM2gS6wEK38B2FPHGb7d7AzAAAAAElFTkSuQmCC',
  // ID/bracelet icon
  noBracelet: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAACXBIWXMAAAsTAAALEwEAmpwYAAABYElEQVR4nO2UP07DQBCFP0JBQUFBQUFBgURBQUFBQQEFBRQUlpaWU1BQUFBQUFAgUVBQUCDxZ3fm57e749hxYiWKk0jRk1Yz/94bezMDO/u3WWAUGAU6wD3wAfyI/goMAofABfA9qD5PC9APHABnwD3wKVr3PzAMHAJd4AF4Eq37O8AQcAh0gHvgWbTu7wBDwCHQAe6AN9G6vwMMAYdAB7gD3kXr/g4wBBwCHeAW+PDfCQwCY0AH2AO6wKv/T2AcGAM6wC7QBV5C5gh6gTGgA+wCXeAlZI6gDxgDdoEOcAe8hswR9ANjwC7QAe6A95A5ggFgDNgFOsA98BEyRzAIjAG7QAd4AD5D5giGgDFgF+gAj8BXyBzBMDAG7AId4An4DpkjGAHGgF2gAzwDPyFzBKPAGLALdIAX4DdkjmAUGAN2gQ7wCvyFzBGMAmPALtABXoH/kJn7D4AxYBPoAK38B1pSHJX9JFDkAAAAAElFTkSuQmCC',
  // Warning/restricted area
  noArea: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAACXBIWXMAAAsTAAALEwEAmpwYAAABVElEQVR4nO2UP0oDURCHvxgLwcJCsLAQLCwsLCwtLS0t/TSChYVgYSFYWAgWgoVgIfiHmd2Z3X1Z8tZNNtnNBvLDwczO+83MLizs7N9+gUlgDLgB3oFv8d+AYeAYuAR+BtXn+QTGgGPgDHgAPsXq/gdGgROgCzwCz6L1/w4wApwAXeABeBGt/3eAEeAE6AL3wKto/b8DjAAnQBe4A95E6/8dYAQ4AbrALfDuvxMYBsaBLrAPPACv/j+BCWAM6AI7QBd4Dpkj6AbGgA6wA3SB55A5gh5gDOgAO0AXeAmZI+gFxoAOsAN0gdeQOYI+YAzoADtAF3gLmSPoB8aADrADdIH3kDmCAWAM6AA7QBf4CJkjGATGgA6wA3SBz5A5giFgDOgAO0AX+AqZIxgGxoAO0AWegZ+QOYJRYA7oAJ/AbGM3MAbsAV3g//8kYBTYB7pAgxj5C5+YJNVN97gKAAAAAElFTkSuQmCC',
  // Apple logo for App Store
  apple: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAACXBIWXMAAAsTAAALEwEAmpwYAAAA7klEQVR4nO2UvwrCMBDGf4qLg4uLi4ODg4OLq++gi4/g4uIgODg4ODg4ODg4CA5+l1xIStqkVHFx8IMj+XL5I3cXuPEPoQ80gSlwAlKR2msNGAROQAfYBY4W3glwAKTAnBvbBLaBS+BLYq8MWPi2JEklcKWp+2CaSYW6b0tSEbhvS1IeuG9LUh64b0tSHrgUXhG4BPbLgAvPqy+D2Cv9T0nKA5fCKwKXwCVwX0myBLoP3AcugfuqYNdPyoHd/5NSuH8VbEpyIJtYsAkJH9rKhbbMvzPkjMiRd0a0nIMSx6FjO7qeYMdW6dja7vQHZo9Nv/VZahQAAAAASUVORK5CYII=',
  // Play icon for Google Play
  play: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAgklEQVR4nO3SsQ3CQBAE0N9cAQQUQEABBBRAQAEk1EFCATRBRkZKFST8C8bSSRdYVuLgIsnRSqvV/tmZ5Z+0xBYnPHFD9+HRDR+cEr9Hg13wO3ThAwPOWCXO+GDZhRdcscKm6DEkOqzxDp4Y5/CN4yv7GNMnTF74Rp8ym+KAXvr8Qgez0CSjkbhiSwAAAABJRU5ErkJggg=='
};

// Invitation translations
const invitationTranslations = {
  ro: {
    subject: 'Invitația ta pentru Festivalul Lupilor',
    greeting: 'Salut',
    youAreInvited: 'Ai fost invitat(ă) la',
    festivalName: 'FESTIVALUL LUPILOR',
    eventDate: '7-9 August 2026',
    eventLocation: 'Orheiul Vechi',
    yourInvitation: 'Invitația ta',
    ticketCode: 'Cod bilet',
    download: 'Descarcă PDF',
    downloadAll: 'Descarcă toate invitațiile',
    saveTickets: 'Te rugăm să salvezi invitațiile și să le prezinți (tipărite sau pe telefon) la intrarea în festival.',
    seeYou: 'Te așteptăm la festival!',
    questions: 'Ai întrebări? Contactează-ne la',
    rights: 'Toate drepturile rezervate',
  },
  ru: {
    subject: 'Твоё приглашение на Festivalul Lupilor',
    greeting: 'Привет',
    youAreInvited: 'Тебя пригласили на',
    festivalName: 'FESTIVALUL LUPILOR',
    eventDate: '7-9 Августа 2026',
    eventLocation: 'Orheiul Vechi',
    yourInvitation: 'Твоё приглашение',
    ticketCode: 'Код билета',
    download: 'Скачать PDF',
    downloadAll: 'Скачать все приглашения',
    saveTickets: 'Сохрани приглашения и предъяви их (распечатанные или на телефоне) на входе на фестиваль.',
    seeYou: 'Ждём тебя на фестивале!',
    questions: 'Есть вопросы? Свяжись с нами',
    rights: 'Все права защищены',
  },
};

// Translations
const translations = {
  ro: {
    subject: 'Biletele tale pentru Festivalul Lupilor',
    greeting: 'Salut',
    thankYou: 'Îți mulțumim pentru achiziție! Comanda ta',
    confirmed: 'a fost confirmată.',
    orderSummary: 'Rezumatul comenzii',
    total: 'Total',
    discount: 'Reducere',
    yourTickets: 'Biletele tale',
    ticketCode: 'Cod bilet',
    download: 'Descarcă PDF',
    downloadAll: 'Descarcă toate biletele',
    processing: 'Se procesează...',
    saveTickets: 'Te rugăm să salvezi biletele și să le prezinți (tipărite sau pe telefon) la intrarea în festival.',
    seeYou: 'Ne vedem la festival!',
    eventDate: '7-9 August 2026',
    eventLocation: 'Orheiul Vechi',
    prohibitedTitle: 'PE TERITORIUL FESTIVALULUI ESTE INTERZIS',
    prohibited: [
      'să vă aflați fără brățara de identificare',
      'să vă urcați pe bariere, corpuri de iluminat, structuri, copaci',
      'să interveniți în activitatea echipamentelor și personalului',
      'să aprindeți orice formă de foc',
      'să montați corturi în afara zonei camping',
      'activități promoționale neautorizate',
      'activitate comercială neautorizată',
      'accesul în zonele închise publicului',
      'încălcarea ordinii publice și vandalismul',
    ],
    downloadApp: 'Descarcă aplicația noastră',
    downloadAppDesc: 'Pentru a nu pierde nicio noutate despre festival',
    questions: 'Ai întrebări? Contactează-ne la',
    rights: 'Toate drepturile rezervate',
  },
  ru: {
    subject: 'Твои билеты на Festivalul Lupilor',
    greeting: 'Привет',
    thankYou: 'Спасибо за покупку! Твой заказ',
    confirmed: 'подтверждён.',
    orderSummary: 'Детали заказа',
    total: 'Итого',
    discount: 'Скидка',
    yourTickets: 'Твои билеты',
    ticketCode: 'Код билета',
    download: 'Скачать PDF',
    downloadAll: 'Скачать все билеты',
    processing: 'Обрабатывается...',
    saveTickets: 'Сохрани билеты и предъяви их (распечатанные или на телефоне) на входе на фестиваль.',
    seeYou: 'Увидимся на фестивале!',
    eventDate: '7-9 Августа 2026',
    eventLocation: 'Orheiul Vechi',
    prohibitedTitle: 'НА ТЕРРИТОРИИ ФЕСТИВАЛЯ ЗАПРЕЩЕНО',
    prohibited: [
      'находиться без идентификационного браслета',
      'залезать на ограждения, осветительные приборы, конструкции, деревья',
      'вмешиваться в работу оборудования и персонала',
      'разводить огонь в любой форме',
      'устанавливать палатки вне зоны кемпинга',
      'несогласованная промо-деятельность',
      'несанкционированная торговля',
      'доступ в закрытые зоны',
      'нарушение общественного порядка и вандализм',
    ],
    downloadApp: 'Скачай наше приложение',
    downloadAppDesc: 'Чтобы не пропустить новости о фестивале',
    questions: 'Есть вопросы? Свяжись с нами',
    rights: 'Все права защищены',
  },
};

function generateEmailHtml(
  order: Order,
  items: OrderItem[],
  pdfUrls: string[],
  t: typeof translations.ro,
  apiUrl: string
): string {
  const showIndividualButtons = items.length <= 2;
  const downloadAllUrl = `${apiUrl}/api/checkout/tickets/${order.order_number}/download`;

  const ticketListHtml = items
    .map(
      (item, index) => `
      <tr>
        <td style="padding: 16px 20px; border-bottom: 1px solid #f0f0f0; font-family: 'SF Mono', 'Monaco', 'Courier New', monospace; font-size: 14px; color: #333; letter-spacing: 0.5px;">
          ${item.ticket_code}
        </td>
        ${showIndividualButtons ? `
        <td style="padding: 16px 20px; border-bottom: 1px solid #f0f0f0; text-align: right;">
          ${
            pdfUrls[index]
              ? `<a href="${pdfUrls[index]}" style="display: inline-block; background: linear-gradient(135deg, #DC5722 0%, #c44d1e 100%); color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; box-shadow: 0 2px 4px rgba(220,87,34,0.3);">${t.download}</a>`
              : `<span style="color: #999; font-size: 14px;">${t.processing}</span>`
          }
        </td>
        ` : ''}
      </tr>
    `
    )
    .join('');

  const downloadAllButtonHtml = !showIndividualButtons ? `
    <tr>
      <td colspan="2" style="padding: 20px; text-align: center;">
        <a href="${downloadAllUrl}" style="display: inline-block; background: linear-gradient(135deg, #DC5722 0%, #c44d1e 100%); color: white; padding: 16px 40px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 16px; box-shadow: 0 4px 12px rgba(220,87,34,0.3);">
          📦 ${t.downloadAll} (${items.length})
        </a>
      </td>
    </tr>
  ` : '';

  // Map each prohibited item to its specific icon
  const prohibitedIcons = [
    icons.noBracelet,  // браслет
    icons.noClimb,     // залезать
    icons.noArea,      // оборудование
    icons.noFire,      // огонь
    icons.noTent,      // палатки
    icons.noEntry,     // промо
    icons.noEntry,     // торговля
    icons.noArea,      // закрытые зоны
    icons.noEntry,     // вандализм
  ];

  const prohibitedHtml = t.prohibited
    .map(
      (text, index) => `
      <tr>
        <td style="padding: 12px 0; vertical-align: top; width: 36px;">
          <img src="${prohibitedIcons[index] || icons.noEntry}" width="24" height="24" alt="" style="display: block;" />
        </td>
        <td style="padding: 12px 0 12px 14px; color: #444; font-size: 14px; line-height: 1.5;">
          ${text}
        </td>
      </tr>
    `
    )
    .join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${t.subject}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">

              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #DC5722 0%, #B8461B 100%); padding: 48px 30px; border-radius: 16px 16px 0 0; text-align: center;">
                  <h1 style="margin: 0 0 12px 0; color: white; font-size: 32px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase;">
                    FESTIVALUL LUPILOR
                  </h1>
                  <p style="margin: 0; color: rgba(255,255,255,0.95); font-size: 16px; font-weight: 500;">
                    ${t.eventDate} • ${t.eventLocation}
                  </p>
                </td>
              </tr>

              <!-- Main Content -->
              <tr>
                <td style="background: #ffffff; padding: 40px 30px;">

                  <!-- Greeting -->
                  <p style="margin: 0 0 20px 0; font-size: 20px; color: #1a1a1a;">
                    ${t.greeting}, <strong>${order.customer_name}</strong>!
                  </p>

                  <p style="margin: 0 0 32px 0; font-size: 16px; color: #555; line-height: 1.6;">
                    ${t.thankYou} <strong style="color: #DC5722;">#${order.order_number}</strong> ${t.confirmed}
                  </p>

                  <!-- Order Summary Box -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="background: #fafafa; border-radius: 12px; margin-bottom: 32px; border-left: 4px solid #DC5722;">
                    <tr>
                      <td style="padding: 24px;">
                        <h3 style="margin: 0 0 16px 0; color: #1a1a1a; font-size: 16px; font-weight: 700;">
                          ${t.orderSummary}
                        </h3>
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td style="padding: 6px 0; color: #666; font-size: 15px;">${t.total}:</td>
                            <td style="padding: 6px 0; color: #1a1a1a; font-size: 20px; font-weight: 700; text-align: right;">
                              ${order.total_amount - order.discount_amount} MDL
                            </td>
                          </tr>
                          ${
                            order.discount_amount > 0
                              ? `
                          <tr>
                            <td style="padding: 6px 0; color: #16a34a; font-size: 15px;">${t.discount}:</td>
                            <td style="padding: 6px 0; color: #16a34a; font-size: 15px; font-weight: 600; text-align: right;">
                              -${order.discount_amount} MDL
                            </td>
                          </tr>
                          `
                              : ''
                          }
                        </table>
                      </td>
                    </tr>
                  </table>

                  <!-- Tickets Section -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e5e5; border-radius: 12px; overflow: hidden; margin-bottom: 32px;">
                    <tr>
                      <td style="background: #1a1a1a; padding: 16px 20px;">
                        <h3 style="margin: 0; color: white; font-size: 16px; font-weight: 700;">
                          ${t.yourTickets} (${items.length})
                        </h3>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <thead>
                            <tr style="background: #fafafa;">
                              <th style="padding: 14px 20px; text-align: left; color: #888; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">
                                ${t.ticketCode}
                              </th>
                              ${showIndividualButtons ? `
                              <th style="padding: 14px 20px; text-align: right; color: #888; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">
                                PDF
                              </th>
                              ` : ''}
                            </tr>
                          </thead>
                          <tbody>
                            ${ticketListHtml}
                            ${downloadAllButtonHtml}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  </table>

                  <!-- Save Tickets Notice -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="background: #FEF3C7; border-radius: 12px; margin-bottom: 32px;">
                    <tr>
                      <td style="padding: 20px;">
                        <p style="margin: 0; color: #92400E; font-size: 14px; line-height: 1.6;">
                          <strong style="font-size: 16px;">💡</strong> ${t.saveTickets}
                        </p>
                      </td>
                    </tr>
                  </table>

                  <!-- See You Message -->
                  <p style="margin: 0; font-size: 22px; color: #DC5722; font-weight: 700; text-align: center;">
                    ${t.seeYou}
                  </p>

                </td>
              </tr>

              <!-- Prohibited Section -->
              <tr>
                <td style="background: #ffffff; padding: 32px 30px; border-top: 1px solid #f0f0f0;">
                  <h3 style="margin: 0 0 24px 0; color: #DC5722; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; text-align: center;">
                    ⚠️ ${t.prohibitedTitle}
                  </h3>
                  <table width="100%" cellpadding="0" cellspacing="0">
                    ${prohibitedHtml}
                  </table>
                </td>
              </tr>

              <!-- Download App Section -->
              <tr>
                <td style="background: linear-gradient(135deg, #DC5722 0%, #B8461B 100%); padding: 40px 30px; text-align: center;">
                  <h3 style="margin: 0 0 8px 0; color: white; font-size: 20px; font-weight: 700;">
                    ${t.downloadApp}
                  </h3>
                  <p style="margin: 0 0 24px 0; color: rgba(255,255,255,0.9); font-size: 14px;">
                    ${t.downloadAppDesc}
                  </p>
                  <table cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                    <tr>
                      <td style="padding-right: 8px;">
                        <a href="https://apps.apple.com" style="display: inline-block; background: #000000; color: white; padding: 12px 20px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px;">
                          <table cellpadding="0" cellspacing="0"><tr>
                            <td style="vertical-align: middle;"><img src="${icons.apple}" width="20" height="20" alt="" style="display: block;" /></td>
                            <td style="vertical-align: middle; padding-left: 10px; color: white; font-weight: 600; font-size: 14px;">App Store</td>
                          </tr></table>
                        </a>
                      </td>
                      <td style="padding-left: 8px;">
                        <a href="https://play.google.com" style="display: inline-block; background: #000000; color: white; padding: 12px 20px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px;">
                          <table cellpadding="0" cellspacing="0"><tr>
                            <td style="vertical-align: middle;"><img src="${icons.play}" width="20" height="20" alt="" style="display: block;" /></td>
                            <td style="vertical-align: middle; padding-left: 10px; color: white; font-weight: 600; font-size: 14px;">Google Play</td>
                          </tr></table>
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background: #1a1a1a; padding: 32px 30px; border-radius: 0 0 16px 16px; text-align: center;">
                  <p style="margin: 0 0 12px 0; color: #999; font-size: 14px;">
                    ${t.questions} <a href="mailto:support@festivalullupilor.md" style="color: #DC5722; text-decoration: none; font-weight: 500;">support@festivalullupilor.md</a>
                  </p>
                  <p style="margin: 0; color: #666; font-size: 12px;">
                    © 2025 Festivalul Lupilor. ${t.rights}.
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

export const emailService = {
  // Send order confirmation with tickets
  async sendOrderConfirmation(
    order: Order,
    items: OrderItem[],
    pdfUrls: string[]
  ): Promise<boolean> {
    try {
      const lang = order.language || 'ro';
      const t = translations[lang];
      const apiUrl = config.apiUrl || 'https://api.festivalullupilor.md';
      const html = generateEmailHtml(order, items, pdfUrls, t, apiUrl);

      const { error } = await resend.emails.send({
        from: config.email.from,
        to: order.customer_email,
        subject: `${t.subject} #${order.order_number}`,
        html,
      });

      if (error) {
        console.error('Send email error:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Email service error:', error);
      return false;
    }
  },

  // Send 1st pending order reminder (soft, after 1 hour)
  async sendFirstReminder(order: Order): Promise<boolean> {
    try {
      const lang = order.language || 'ro';
      const isRu = lang === 'ru';

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${isRu ? 'Забыли оплатить?' : 'Ai uitat să plătești?'}</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">

                  <!-- Header -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 48px 30px; border-radius: 16px 16px 0 0; text-align: center;">
                      <h1 style="margin: 0; color: white; font-size: 26px; font-weight: 800;">
                        ${isRu ? 'Забыли оплатить?' : 'Ai uitat să plătești?'}
                      </h1>
                    </td>
                  </tr>

                  <!-- Content -->
                  <tr>
                    <td style="background: #ffffff; padding: 40px 30px; border-radius: 0 0 16px 16px;">
                      <p style="margin: 0 0 20px 0; font-size: 20px; color: #1a1a1a;">
                        ${isRu ? 'Привет' : 'Salut'}, <strong>${order.customer_name}</strong>!
                      </p>

                      <p style="margin: 0 0 20px 0; font-size: 16px; color: #555; line-height: 1.6;">
                        ${isRu ? 'Мы заметили, что ты начал оформление заказа, но не завершил оплату.' : 'Am observat că ai început o comandă, dar nu ai finalizat plata.'}
                      </p>

                      <p style="margin: 0 0 32px 0; font-size: 16px; color: #555;">
                        ${isRu ? 'Твои билеты всё ещё ждут тебя!' : 'Biletele tale te așteaptă încă!'}
                      </p>

                      <table width="100%" cellpadding="0" cellspacing="0" style="background: #fafafa; border-radius: 12px; margin-bottom: 32px;">
                        <tr>
                          <td style="padding: 32px; text-align: center;">
                            <p style="margin: 0 0 8px 0; color: #666; font-size: 14px;">${isRu ? 'Сумма заказа' : 'Suma comenzii'}:</p>
                            <p style="margin: 0 0 24px 0; color: #1a1a1a; font-size: 32px; font-weight: 700;">
                              ${order.total_amount - order.discount_amount} MDL
                            </p>
                            <a href="${config.frontendUrl}/${lang}/tickets"
                               style="display: inline-block; background: linear-gradient(135deg, #DC5722 0%, #c44d1e 100%); color: white; padding: 16px 40px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 16px; box-shadow: 0 4px 12px rgba(220,87,34,0.3);">
                              ${isRu ? 'Купить билеты' : 'Cumpără bilete'}
                            </a>
                          </td>
                        </tr>
                      </table>

                      <p style="margin: 0; color: #888; font-size: 14px; text-align: center;">
                        ${isRu ? 'Билеты разлетаются быстро!' : 'Biletele se vând rapid!'}
                      </p>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="padding: 32px; text-align: center;">
                      <p style="margin: 0; color: #666; font-size: 12px;">
                        © 2025 Festivalul Lupilor
                      </p>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;

      const { error } = await resend.emails.send({
        from: config.email.from,
        to: order.customer_email,
        subject: isRu
          ? `Забыли оплатить? - Festivalul Lupilor`
          : `Ai uitat să plătești? - Festivalul Lupilor`,
        html,
      });

      if (error) {
        console.error('Send 1st reminder error:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Email service error:', error);
      return false;
    }
  },

  // Send 2nd pending order reminder (urgency, after 24 hours)
  async sendSecondReminder(order: Order): Promise<boolean> {
    try {
      const lang = order.language || 'ro';
      const isRu = lang === 'ru';

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${isRu ? 'Билеты ещё ждут тебя!' : 'Biletele te așteaptă!'}</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">

                  <!-- Header with urgency -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #DC2626 0%, #B91C1C 100%); padding: 48px 30px; border-radius: 16px 16px 0 0; text-align: center;">
                      <h1 style="margin: 0; color: white; font-size: 26px; font-weight: 800;">
                        ${isRu ? 'Билеты ещё ждут тебя!' : 'Biletele te așteaptă!'}
                      </h1>
                    </td>
                  </tr>

                  <!-- Content -->
                  <tr>
                    <td style="background: #ffffff; padding: 40px 30px;">
                      <p style="margin: 0 0 20px 0; font-size: 20px; color: #1a1a1a;">
                        ${isRu ? 'Привет' : 'Salut'}, <strong>${order.customer_name}</strong>!
                      </p>

                      <p style="margin: 0 0 20px 0; font-size: 16px; color: #555; line-height: 1.6;">
                        ${isRu
                          ? 'Вчера ты хотел купить билеты на Festivalul Lupilor, но что-то пошло не так...'
                          : 'Ieri ai vrut să cumperi bilete la Festivalul Lupilor, dar ceva nu a mers...'}
                      </p>

                      <!-- Urgency box -->
                      <table width="100%" cellpadding="0" cellspacing="0" style="background: #FEF2F2; border: 2px solid #FECACA; border-radius: 12px; margin-bottom: 24px;">
                        <tr>
                          <td style="padding: 20px; text-align: center;">
                            <p style="margin: 0; color: #DC2626; font-size: 16px; font-weight: 600;">
                              ${isRu
                                ? 'Билеты заканчиваются! Не упусти свой шанс!'
                                : 'Biletele se epuizează! Nu rata șansa ta!'}
                            </p>
                          </td>
                        </tr>
                      </table>

                      <table width="100%" cellpadding="0" cellspacing="0" style="background: #fafafa; border-radius: 12px; margin-bottom: 32px;">
                        <tr>
                          <td style="padding: 32px; text-align: center;">
                            <p style="margin: 0 0 8px 0; color: #666; font-size: 14px;">${isRu ? 'Сумма заказа' : 'Suma comenzii'}:</p>
                            <p style="margin: 0 0 24px 0; color: #1a1a1a; font-size: 32px; font-weight: 700;">
                              ${order.total_amount - order.discount_amount} MDL
                            </p>
                            <a href="${config.frontendUrl}/${lang}/tickets"
                               style="display: inline-block; background: linear-gradient(135deg, #DC2626 0%, #B91C1C 100%); color: white; padding: 16px 40px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 16px; box-shadow: 0 4px 12px rgba(220,38,38,0.3);">
                              ${isRu ? 'Купить билеты сейчас' : 'Cumpără bilete acum'}
                            </a>
                          </td>
                        </tr>
                      </table>

                      <!-- Event info -->
                      <table width="100%" cellpadding="0" cellspacing="0" style="border-top: 1px solid #eee; padding-top: 24px;">
                        <tr>
                          <td style="text-align: center;">
                            <p style="margin: 0 0 8px 0; color: #DC5722; font-size: 18px; font-weight: 700;">
                              FESTIVALUL LUPILOR
                            </p>
                            <p style="margin: 0; color: #666; font-size: 14px;">
                              7-9 ${isRu ? 'Августа' : 'August'} 2026 • Orheiul Vechi
                            </p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="background: #1a1a1a; padding: 24px 30px; border-radius: 0 0 16px 16px; text-align: center;">
                      <p style="margin: 0; color: #666; font-size: 12px;">
                        © 2025 Festivalul Lupilor
                      </p>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;

      const { error } = await resend.emails.send({
        from: config.email.from,
        to: order.customer_email,
        subject: isRu
          ? `Билеты ещё ждут тебя! - Festivalul Lupilor`
          : `Biletele te așteaptă! - Festivalul Lupilor`,
        html,
      });

      if (error) {
        console.error('Send 2nd reminder error:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Email service error:', error);
      return false;
    }
  },

  // Send invitation email with tickets
  async sendInvitationEmail(
    order: Order,
    items: OrderItem[],
    pdfUrls: string[]
  ): Promise<boolean> {
    try {
      const lang = order.language || 'ro';
      const t = invitationTranslations[lang];
      const apiUrl = config.apiUrl || 'https://api.festivalullupilor.md';
      const showIndividualButtons = items.length <= 2;
      const downloadAllUrl = `${apiUrl}/api/checkout/tickets/${order.order_number}/download`;

      const ticketListHtml = items
        .map(
          (item, index) => `
          <tr>
            <td style="padding: 16px 20px; border-bottom: 1px solid #f0f0f0; font-family: 'SF Mono', 'Monaco', 'Courier New', monospace; font-size: 14px; color: #333; letter-spacing: 0.5px;">
              ${item.ticket_code}
            </td>
            ${showIndividualButtons ? `
            <td style="padding: 16px 20px; border-bottom: 1px solid #f0f0f0; text-align: right;">
              ${
                pdfUrls[index]
                  ? `<a href="${pdfUrls[index]}" style="display: inline-block; background: linear-gradient(135deg, #D4AF37 0%, #B8962C 100%); color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; box-shadow: 0 2px 4px rgba(212,175,55,0.3);">${t.download}</a>`
                  : `<span style="color: #999; font-size: 14px;">...</span>`
              }
            </td>
            ` : ''}
          </tr>
        `
        )
        .join('');

      const downloadAllButtonHtml = !showIndividualButtons ? `
        <tr>
          <td colspan="2" style="padding: 20px; text-align: center;">
            <a href="${downloadAllUrl}" style="display: inline-block; background: linear-gradient(135deg, #D4AF37 0%, #B8962C 100%); color: white; padding: 16px 40px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 16px; box-shadow: 0 4px 12px rgba(212,175,55,0.3);">
              ${t.downloadAll} (${items.length})
            </a>
          </td>
        </tr>
      ` : '';

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${t.subject}</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">

                  <!-- Header with Gold gradient for invitation -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #D4AF37 0%, #B8962C 100%); padding: 48px 30px; border-radius: 16px 16px 0 0; text-align: center;">
                      <div style="display: inline-block; background: rgba(255,255,255,0.2); padding: 8px 24px; border-radius: 20px; margin-bottom: 16px;">
                        <span style="color: white; font-size: 14px; font-weight: 700; letter-spacing: 2px;">INVITATION</span>
                      </div>
                      <h1 style="margin: 0 0 12px 0; color: white; font-size: 32px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase;">
                        ${t.festivalName}
                      </h1>
                      <p style="margin: 0; color: rgba(255,255,255,0.95); font-size: 16px; font-weight: 500;">
                        ${t.eventDate} • ${t.eventLocation}
                      </p>
                    </td>
                  </tr>

                  <!-- Main Content -->
                  <tr>
                    <td style="background: #ffffff; padding: 40px 30px;">

                      <!-- Greeting -->
                      <p style="margin: 0 0 20px 0; font-size: 20px; color: #1a1a1a;">
                        ${t.greeting}, <strong>${order.customer_name}</strong>!
                      </p>

                      <p style="margin: 0 0 32px 0; font-size: 16px; color: #555; line-height: 1.6;">
                        ${t.youAreInvited} <strong style="color: #D4AF37;">${t.festivalName}</strong>!
                      </p>

                      <!-- Tickets Section -->
                      <table width="100%" cellpadding="0" cellspacing="0" style="border: 2px solid #D4AF37; border-radius: 12px; overflow: hidden; margin-bottom: 32px;">
                        <tr>
                          <td style="background: linear-gradient(135deg, #D4AF37 0%, #B8962C 100%); padding: 16px 20px;">
                            <h3 style="margin: 0; color: white; font-size: 16px; font-weight: 700;">
                              ${t.yourInvitation} (${items.length})
                            </h3>
                          </td>
                        </tr>
                        <tr>
                          <td>
                            <table width="100%" cellpadding="0" cellspacing="0">
                              <thead>
                                <tr style="background: #fafafa;">
                                  <th style="padding: 14px 20px; text-align: left; color: #888; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">
                                    ${t.ticketCode}
                                  </th>
                                  ${showIndividualButtons ? `
                                  <th style="padding: 14px 20px; text-align: right; color: #888; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">
                                    PDF
                                  </th>
                                  ` : ''}
                                </tr>
                              </thead>
                              <tbody>
                                ${ticketListHtml}
                                ${downloadAllButtonHtml}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      </table>

                      <!-- Save Tickets Notice -->
                      <table width="100%" cellpadding="0" cellspacing="0" style="background: #FEF9E7; border-radius: 12px; margin-bottom: 32px;">
                        <tr>
                          <td style="padding: 20px;">
                            <p style="margin: 0; color: #8B6914; font-size: 14px; line-height: 1.6;">
                              <strong style="font-size: 16px;">💡</strong> ${t.saveTickets}
                            </p>
                          </td>
                        </tr>
                      </table>

                      <!-- See You Message -->
                      <p style="margin: 0; font-size: 22px; color: #D4AF37; font-weight: 700; text-align: center;">
                        ${t.seeYou}
                      </p>

                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="background: #1a1a1a; padding: 32px 30px; border-radius: 0 0 16px 16px; text-align: center;">
                      <p style="margin: 0 0 12px 0; color: #999; font-size: 14px;">
                        ${t.questions} <a href="mailto:support@festivalullupilor.md" style="color: #D4AF37; text-decoration: none; font-weight: 500;">support@festivalullupilor.md</a>
                      </p>
                      <p style="margin: 0; color: #666; font-size: 12px;">
                        © 2025 Festivalul Lupilor. ${t.rights}.
                      </p>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;

      const { error } = await resend.emails.send({
        from: config.email.from,
        to: order.customer_email,
        subject: `${t.subject} #${order.order_number}`,
        html,
      });

      if (error) {
        console.error('Send invitation email error:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Invitation email service error:', error);
      return false;
    }
  },

  // Send B2B invoice
  async sendB2BInvoice(
    orderNumber: string,
    companyName: string,
    contactName: string,
    contactEmail: string,
    invoiceNumber: string,
    invoiceUrl: string,
    finalAmount: number,
    language: 'ro' | 'ru'
  ): Promise<boolean> {
    try {
      const isRu = language === 'ru';

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${isRu ? 'Счёт на оплату' : 'Factură proformă'}</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">

                  <!-- Header -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%); padding: 48px 30px; border-radius: 16px 16px 0 0; text-align: center;">
                      <h1 style="margin: 0 0 12px 0; color: white; font-size: 28px; font-weight: 800;">
                        ${isRu ? 'Счёт на оплату' : 'Factură proformă'}
                      </h1>
                      <p style="margin: 0; color: rgba(255,255,255,0.9); font-size: 16px;">
                        ${isRu ? 'Festivalul Lupilor - B2B заказ' : 'Festivalul Lupilor - Comandă B2B'}
                      </p>
                    </td>
                  </tr>

                  <!-- Content -->
                  <tr>
                    <td style="background: #ffffff; padding: 40px 30px;">
                      <p style="margin: 0 0 20px 0; font-size: 20px; color: #1a1a1a;">
                        ${isRu ? 'Здравствуйте' : 'Bună ziua'}, <strong>${contactName}</strong>!
                      </p>

                      <p style="margin: 0 0 32px 0; font-size: 16px; color: #555; line-height: 1.6;">
                        ${isRu
                          ? `Благодарим за заказ! Ваш счёт ${invoiceNumber} готов к оплате.`
                          : `Vă mulțumim pentru comandă! Factura ${invoiceNumber} este gata de plată.`}
                      </p>

                      <!-- Invoice Box -->
                      <table width="100%" cellpadding="0" cellspacing="0" style="background: #f8fafc; border: 2px solid #1e40af; border-radius: 12px; margin-bottom: 32px;">
                        <tr>
                          <td style="padding: 32px;">
                            <table width="100%" cellpadding="0" cellspacing="0">
                              <tr>
                                <td style="padding: 8px 0; color: #666; font-size: 14px;">${isRu ? 'Компания:' : 'Companie:'}</td>
                                <td style="padding: 8px 0; color: #1a1a1a; font-weight: 600; text-align: right;">${companyName}</td>
                              </tr>
                              <tr>
                                <td style="padding: 8px 0; color: #666; font-size: 14px;">${isRu ? '№ Заказа:' : 'Nr. Comandă:'}</td>
                                <td style="padding: 8px 0; color: #1a1a1a; font-weight: 600; text-align: right;">${orderNumber}</td>
                              </tr>
                              <tr>
                                <td style="padding: 8px 0; color: #666; font-size: 14px;">${isRu ? '№ Счёта:' : 'Nr. Factură:'}</td>
                                <td style="padding: 8px 0; color: #1a1a1a; font-weight: 600; text-align: right;">${invoiceNumber}</td>
                              </tr>
                              <tr>
                                <td colspan="2" style="padding: 20px 0 8px 0; border-top: 2px solid #e2e8f0;"></td>
                              </tr>
                              <tr>
                                <td style="padding: 8px 0; color: #1e40af; font-size: 16px; font-weight: 700;">${isRu ? 'ИТОГО К ОПЛАТЕ:' : 'TOTAL DE PLATĂ:'}</td>
                                <td style="padding: 8px 0; color: #1e40af; font-size: 24px; font-weight: 800; text-align: right;">${Math.round(finalAmount).toLocaleString()} MDL</td>
                              </tr>
                            </table>

                            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 24px;">
                              <tr>
                                <td style="text-align: center;">
                                  <a href="${invoiceUrl}" style="display: inline-block; background: linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%); color: white; padding: 16px 40px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 16px; box-shadow: 0 4px 12px rgba(30,64,175,0.3);">
                                    📄 ${isRu ? 'Скачать счёт' : 'Descarcă factura'}
                                  </a>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>

                      <!-- Payment Instructions -->
                      <table width="100%" cellpadding="0" cellspacing="0" style="background: #fffbeb; border-radius: 12px; margin-bottom: 32px;">
                        <tr>
                          <td style="padding: 20px;">
                            <p style="margin: 0 0 12px 0; color: #92400e; font-size: 16px; font-weight: 700;">
                              ${isRu ? 'Инструкция по оплате:' : 'Instrucțiuni de plată:'}
                            </p>
                            <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.6;">
                              ${isRu
                                ? 'Пожалуйста, укажите номер счёта в описании платежа. После получения оплаты мы сгенерируем и отправим билеты на этот email.'
                                : 'Vă rugăm să indicați numărul facturii în descrierea plății. După primirea plății, vom genera și trimite biletele pe acest email.'}
                            </p>
                          </td>
                        </tr>
                      </table>

                      <p style="margin: 0; font-size: 18px; color: #1e40af; font-weight: 700; text-align: center;">
                        ${isRu ? 'Спасибо за сотрудничество!' : 'Mulțumim pentru colaborare!'}
                      </p>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="background: #1a1a1a; padding: 32px 30px; border-radius: 0 0 16px 16px; text-align: center;">
                      <p style="margin: 0 0 12px 0; color: #999; font-size: 14px;">
                        ${isRu ? 'Есть вопросы? Свяжитесь с нами' : 'Ai întrebări? Contactează-ne la'} <a href="mailto:b2b@festivalullupilor.md" style="color: #1e40af; text-decoration: none; font-weight: 500;">b2b@festivalullupilor.md</a>
                      </p>
                      <p style="margin: 0; color: #666; font-size: 12px;">
                        © 2025 Festivalul Lupilor
                      </p>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;

      const { error } = await resend.emails.send({
        from: config.email.from,
        to: contactEmail,
        subject: isRu
          ? `Счёт на оплату ${invoiceNumber} - Festivalul Lupilor`
          : `Factură ${invoiceNumber} - Festivalul Lupilor`,
        html,
      });

      if (error) {
        console.error('Send B2B invoice error:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('B2B invoice email error:', error);
      return false;
    }
  },

  // Send B2B tickets
  async sendB2BTickets(
    orderNumber: string,
    companyName: string,
    contactName: string,
    contactEmail: string,
    ticketCount: number,
    language: 'ro' | 'ru'
  ): Promise<boolean> {
    try {
      const isRu = language === 'ru';
      const apiUrl = config.apiUrl || 'https://api.festivalullupilor.md';
      const downloadAllUrl = `${apiUrl}/api/b2b/orders/${orderNumber}/download-tickets`;

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${isRu ? 'Ваши билеты' : 'Biletele dumneavoastră'}</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">

                  <!-- Header -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 48px 30px; border-radius: 16px 16px 0 0; text-align: center;">
                      <h1 style="margin: 0 0 12px 0; color: white; font-size: 32px; font-weight: 800; letter-spacing: 2px;">
                        ${isRu ? 'БИЛЕТЫ ГОТОВЫ!' : 'BILETE GATA!'}
                      </h1>
                      <p style="margin: 0; color: rgba(255,255,255,0.9); font-size: 16px;">
                        Festivalul Lupilor - B2B ${isRu ? 'Заказ' : 'Comandă'}
                      </p>
                    </td>
                  </tr>

                  <!-- Content -->
                  <tr>
                    <td style="background: #ffffff; padding: 40px 30px;">
                      <p style="margin: 0 0 20px 0; font-size: 20px; color: #1a1a1a;">
                        ${isRu ? 'Здравствуйте' : 'Bună ziua'}, <strong>${contactName}</strong>!
                      </p>

                      <p style="margin: 0 0 32px 0; font-size: 16px; color: #555; line-height: 1.6;">
                        ${isRu
                          ? `Ваши ${ticketCount} билетов для <strong>${companyName}</strong> готовы!`
                          : `Cele ${ticketCount} bilete pentru <strong>${companyName}</strong> sunt gata!`}
                      </p>

                      <!-- Download Box -->
                      <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 2px solid #059669; border-radius: 12px; margin-bottom: 32px;">
                        <tr>
                          <td style="padding: 40px; text-align: center;">
                            <p style="margin: 0 0 8px 0; color: #047857; font-size: 14px; font-weight: 600;">
                              ${isRu ? '№ Заказа:' : 'Nr. Comandă:'} <strong>${orderNumber}</strong>
                            </p>
                            <p style="margin: 0 0 24px 0; color: #059669; font-size: 32px; font-weight: 800;">
                              ${ticketCount} ${isRu ? 'билетов' : 'bilete'}
                            </p>
                            <a href="${downloadAllUrl}" style="display: inline-block; background: linear-gradient(135deg, #059669 0%, #047857 100%); color: white; padding: 18px 48px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 18px; box-shadow: 0 4px 16px rgba(5,150,105,0.4);">
                              📦 ${isRu ? 'Скачать все билеты' : 'Descarcă toate biletele'}
                            </a>
                          </td>
                        </tr>
                      </table>

                      <!-- Important Notice -->
                      <table width="100%" cellpadding="0" cellspacing="0" style="background: #fef3c7; border-radius: 12px; margin-bottom: 32px;">
                        <tr>
                          <td style="padding: 20px;">
                            <p style="margin: 0 0 12px 0; color: #92400e; font-size: 16px; font-weight: 700;">
                              💡 ${isRu ? 'Важно:' : 'Important:'}
                            </p>
                            <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.6;">
                              ${isRu
                                ? 'Каждый билет содержит уникальный QR-код. Пожалуйста, убедитесь, что каждый участник имеет свой билет (распечатанный или на телефоне) при входе на фестиваль.'
                                : 'Fiecare bilet conține un cod QR unic. Vă rugăm să vă asigurați că fiecare participant are biletul său (tipărit sau pe telefon) la intrarea pe festival.'}
                            </p>
                          </td>
                        </tr>
                      </table>

                      <!-- Event Info -->
                      <table width="100%" cellpadding="0" cellspacing="0" style="background: #fafafa; border-radius: 12px; padding: 24px;">
                        <tr>
                          <td style="text-align: center;">
                            <p style="margin: 0 0 8px 0; color: #DC5722; font-size: 24px; font-weight: 800; letter-spacing: 2px;">
                              FESTIVALUL LUPILOR
                            </p>
                            <p style="margin: 0; color: #666; font-size: 16px;">
                              7-9 ${isRu ? 'Августа' : 'August'} 2026 • Orheiul Vechi
                            </p>
                          </td>
                        </tr>
                      </table>

                      <p style="margin: 32px 0 0 0; font-size: 22px; color: #059669; font-weight: 700; text-align: center;">
                        ${isRu ? 'Ждём вас на фестивале!' : 'Vă așteptăm la festival!'}
                      </p>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="background: #1a1a1a; padding: 32px 30px; border-radius: 0 0 16px 16px; text-align: center;">
                      <p style="margin: 0 0 12px 0; color: #999; font-size: 14px;">
                        ${isRu ? 'Есть вопросы? Свяжитесь с нами' : 'Ai întrebări? Contactează-ne la'} <a href="mailto:b2b@festivalullupilor.md" style="color: #059669; text-decoration: none; font-weight: 500;">b2b@festivalullupilor.md</a>
                      </p>
                      <p style="margin: 0; color: #666; font-size: 12px;">
                        © 2025 Festivalul Lupilor
                      </p>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;

      const { error } = await resend.emails.send({
        from: config.email.from,
        to: contactEmail,
        subject: isRu
          ? `Ваши билеты готовы! - Festivalul Lupilor`
          : `Biletele dumneavoastră sunt gata! - Festivalul Lupilor`,
        html,
      });

      if (error) {
        console.error('Send B2B tickets error:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('B2B tickets email error:', error);
      return false;
    }
  },
};
