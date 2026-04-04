const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const nodemailer = require('nodemailer');

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

                let mailOptions = {
                    from: `"Osiris Agtech 🌱" <${gmailUser}>`,
                    to: emailResponsavel,
                    subject: 'Lembrete de atividade agendada',
                    text: 'Olá, você tem uma atividade agendada para hoje: \n\n' + agenda.titulo + '\n' + agenda.descricao + '\nData e hora:' + agenda.data + '\nConta: ' + agenda.conta.nome + '\n\nAtenciosamente, \nEquipe Osiris Agtech 🌱',
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
