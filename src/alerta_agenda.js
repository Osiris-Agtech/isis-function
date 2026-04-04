const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const nodemailer = require('nodemailer');

async function verificarEEnviarEmail() {
    try {
        // Consultar o banco de dados para buscar as agendas com a propriedade "data" igual a hoje
        const agendasHoje = await prisma.agenda.findMany({
            where: {
                AND: {
                    0: {
                        data: {
                            "gte": substractDays(new Date(), 1).toISOString().split('T')[0] + 'T00:00:00.000Z',
                            "lt": new Date().toISOString().split('T')[0] + 'T00:00:00.000Z'
                        },
                    },
                    1: {
                        finalizado: false
                    }
                }
            },
            include: {
                usuario: true,
                conta: true
            }
        });

        console.log(substractDays(new Date(), 1).toISOString().split('T')[0] + 'T00:00:00.000Z', new Date().toISOString().split('T')[0] + 'T00:00:00.000Z')
        console.log('Agendas encontradas:', agendasHoje);

        // Iterar sobre as agendas encontradas e enviar e-mail para cada responsável
        for (const agenda of agendasHoje) {
            var emailResponsavel;
            if(agenda.usuario != null){
                emailResponsavel = agenda.usuario.email;
            }

            if(emailResponsavel != null && emailResponsavel != undefined && emailResponsavel != ''){

                const gmailUser = process.env.GMAIL_USER;
                const gmailPassword = process.env.GMAIL_PASSWORD;

                if (!gmailUser || !gmailPassword) {
                    console.error('GMAIL_USER ou GMAIL_PASSWORD não definidos nas variáveis de ambiente');
                    continue;
                }

                let mailOptions = {
                    from: `"Osiris Agtech 🌱" <${gmailUser}>`,
                    to: emailResponsavel,
                    subject: 'Lembrete de atividade agendada',
                    text: 'Olá, você tem uma atividade agendada para hoje: \n\n' + agenda.titulo + '\n' + agenda.descricao + '\nData e hora:' + agenda.data + '\nConta: ' + agenda.conta.nome + '\n\nAtenciosamente, \nEquipe Osiris Agtech 🌱',
                };

                // Mail transport configuration
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

        console.log('E-mails enviados com sucesso!');
    } catch (error) {
        console.error('Erro ao consultar ou enviar e-mails:', error);
    }
}

function addDays(date, days) {
    const newDate = new Date(date);
    newDate.setDate(date.getDate() + days);
    return newDate;
}

function substractDays(date, days) {
    const newDate = new Date(date);
    newDate.setDate(date.getDate() - days);
    return newDate;
}

module.exports = { verificarEEnviarEmail };