const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const nodemailer = require('nodemailer');

const APP_BRAND_NAME = 'Aplicativo de Gestão de Cultivos - UFMT';

function formatAgendaDate(value) {
    if (!value) {
        return 'Não informada';
    }

    return new Date(value).toLocaleString('pt-BR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
}

function buildAgendaReminderEmail(agenda) {
    const dataFormatada = formatAgendaDate(agenda.data);
    const titulo = agenda.titulo || 'Atividade sem título';
    const descricao = agenda.descricao || 'Sem descrição';
    const contaNome = agenda.conta?.nome || 'Conta não informada';

    return {
        text:
            'Olá!\n\n' +
            'Você possui uma atividade agendada.\n\n' +
            `Título: ${titulo}\n` +
            `Descrição: ${descricao}\n` +
            `Data e hora: ${dataFormatada}\n` +
            `Conta: ${contaNome}\n\n` +
            'Acesse o aplicativo para acompanhar os detalhes.\n\n' +
            `Mensagem automática do ${APP_BRAND_NAME}.`,
        html: `
            <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.5;">
                <h2 style="margin: 0 0 8px 0;">${APP_BRAND_NAME}</h2>
                <h3 style="margin: 0 0 16px 0; color: #0f766e;">Lembrete de atividade agendada</h3>
                <p style="margin: 0 0 16px 0;">Você possui uma atividade agendada.</p>
                <ul style="margin: 0 0 16px 20px; padding: 0;">
                    <li><strong>Título:</strong> ${titulo}</li>
                    <li><strong>Descrição:</strong> ${descricao}</li>
                    <li><strong>Data e hora:</strong> ${dataFormatada}</li>
                    <li><strong>Conta:</strong> ${contaNome}</li>
                </ul>
                <p style="margin: 0 0 16px 0;"><strong>Acesse o aplicativo para acompanhar os detalhes.</strong></p>
                <p style="margin: 0; color: #4b5563;">Mensagem automática do ${APP_BRAND_NAME}.</p>
            </div>
        `,
    };
}

async function handleAlertaAgenda() {
    try {
        const agendasHoje = await prisma.agenda.findMany({
            where: {
                AND: [
                    {
                        data: {
                            "gte": substractDays(new Date(), 1).toISOString().split('T')[0] + 'T00:00:00.000Z',
                            "lt": new Date().toISOString().split('T')[0] + 'T00:00:00.000Z'
                        },
                    },
                    {
                        finalizado: false
                    }
                ]
            },
            include: {
                usuario: true,
                conta: true
            }
        });

        console.log('Agendas encontradas:', agendasHoje.length);

        if (agendasHoje.length === 0) {
            console.log('Nenhum alerta pendente');
            return;
        }

        for (const agenda of agendasHoje) {
            var emailResponsavel;
            if (agenda.usuario != null) {
                emailResponsavel = agenda.usuario.email;
            }

            if (emailResponsavel != null && emailResponsavel !== undefined && emailResponsavel !== '') {
                const gmailUser = process.env.GMAIL_USER;
                const gmailPassword = process.env.GMAIL_PASSWORD;

                if (!gmailUser || !gmailPassword) {
                    console.error('GMAIL_USER ou GMAIL_PASSWORD não definidos');
                    continue;
                }

                const emailContent = buildAgendaReminderEmail(agenda);

                let mailOptions = {
                    from: `"${APP_BRAND_NAME}" <${gmailUser}>`,
                    to: emailResponsavel,
                    subject: 'Lembrete de atividade agendada',
                    text: emailContent.text,
                    html: emailContent.html,
                };

                let transporter = nodemailer.createTransport({
                    service: 'gmail',
                    auth: {
                        user: gmailUser,
                        pass: gmailPassword,
                    },
                    tls: {
                        rejectUnauthorized: false,
                    },
                });

                transporter.sendMail(mailOptions, (error, info) => {
                    if (error) console.log(error);
                    else console.log('Email sent: ' + info.response);
                });
            }
        }

        console.log('Processo de alerta concluído!');
    } catch (error) {
        console.error('Erro ao consultar ou enviar e-mails:', error);
    } finally {
        await prisma.$disconnect();
    }
}

function substractDays(date, days) {
    const newDate = new Date(date);
    newDate.setDate(date.getDate() - days);
    return newDate;
}

module.exports = { handleAlertaAgenda };
