'use strict';

const aws = require('aws-sdk');
const axios = require('axios');
const regex = require('./regex.json');

const isBodyValid = body => {
  let errors = [];

  for (let key in body) {
    regex.forEach(re => {
      if (key === re.type) {
        if (!body[key].match(new RegExp(re.pattern, re.flag))) {
          errors.push({
            input: re.type,
            message: re.message
          });
        };
      }
    });
  }

  return errors;
};

const isCaptchaValid = body => {
  const recaptcha = body['g-recaptcha-response'];

  if (recaptcha === '' || recaptcha === null) {
    return true;
  }

  return axios.get(`https://www.google.com/recaptcha/api/siteverify?secret=${process.env.CAPTCHA_KEY}&response=${recaptcha}`).then(({success}) => {
    if (!success) {
      return true;
    }
    return false;
  }).catch(error => console.log(error));
};

const sendEmail = async body => {
  const bodyErrors = isBodyValid(body);
  const captchaErrors = isCaptchaValid(body);
  
  if (bodyErrors.length > 0) {
    throw new Error(JSON.stringify(bodyErrors));
  }

  if (captchaErrors) {
    throw new Error('Invalid reCAPTCHA.');
  }

  const SES = new aws.SES();
  const response = await SES.sendEmail({
    Source: process.env.EMAIL_ACCOUNT,
    Destination: {
      ToAddresses: [process.env.EMAIL_ACCOUNT]
    },
    ReplyToAddresses: [body.email],
    Message: {
      Subject: {
        Charset: 'UTF-8',
        Data: `Portfolio: ${body.subject}`
      },
      Body: {
        Text: {
          Charset: 'UTF-8',
          Data: `New message received from ${body.name} (${body.email}):\n${body.message}`
        }
      }
    }
  }).promise();

  return response;
};

module.exports.email = async event => {
  try {
    let body = {};
    if (event.body) {
      body = JSON.parse(event.body);
    }
    const response = await sendEmail(body);
    return {
      statusCode : 200,
      body: JSON.stringify(response)
    };
  } catch (error) {
    return {
      statusCode : 500,
      body: error.message
    };
  }
};
