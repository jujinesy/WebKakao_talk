const express = require('express');
const { json, urlencoded } = require('body-parser');
const { resolve } = require('path');
const cluster = require('cluster');
const sassMiddleware = require('node-sass-middleware');
const { TalkClient, TestUtil, AuthStatusCode, StatusCode } = require('node-kakao');
const { cpus } = require('os');

const port = process.env.PORT || 3000;

if (cluster.isMaster) {
  console.log(`master process: ${process.pid}`);

  cpus().forEach(() => cluster.fork());

  cluster.on('exit', (w, c, s) => {
    console.log(`${w.process.pid} exited`);
    cluster.fork();
  });
} else if (cluster.isWorker) {
  const app = express();
  const clients = new Object();

  app.set('views', resolve(__dirname, './views'));
  app.set('view engine', 'ejs');
  app.use(
    sassMiddleware({
      src: resolve(__dirname, './scss'),
      dest: resolve(__dirname, './public/css'),
      debug: true,
      outputStyle: 'compressed',
      prefix: '/css',
    })
  );
  app.use(express.static(resolve(__dirname, './public')));
  app.use(json());
  app.use(urlencoded({ extended: true }));

  app.get('/', (req, res) => {
    res.render('index');
  });

  app.get('/api/login', (req, res) => {
    const client = new TalkClient('WebTalk', 'loco');

    client.login(req.query.email, req.query.password).catch((err) => {
      if (err.status === AuthStatusCode.DEVICE_NOT_REGISTERED) {
        client.Auth.requestPasscode(req.query.email, req.query.password, true); // 개쩔고
        res.send('인증번호를 전송했습니다.');
      } else if (err.status === AuthStatusCode.ANOTHER_LOGON) {
        res.send('이미 로그인된 디바이스가 있습니다.');
      } else {
        console.error(err);
        return res.send(`예상치 못한 에러가 발생하였습니다:\n${err.message}`);
      }
    });

    client.once('login', () => {
      clients[client.ClientUser.MainUserInfo.Id.toString()] = {
        client,
        password: (() => {
          let { password } = req.query;
          // do something!
          return password;
        })(),
      };
      res.send(`${client.ClientUser.MainUserInfo.Nickname}로 로그인했습니다.`);
    });
  });

  app.get('/api/registerDevice', (req, res) => {
    const client = new TalkClient('WebTalk', 'loco');
    // 가입도 되유? 안되는데 이거 기기 인증임 아하
    client.Auth.registerDevice(req.query.passcode, req.query.email, req.query.password, true, true).then((err) => {
      if (err.status === StatusCode.SUCCESS) {
        res.send('로그인하세요 ㅎ');
      } else {
        console.error(err);
        return res.send(`예상치 못한 에러가 발생하였습니다:\n${err.message}`);
      }
    });
  });

  app.listen(port, () => console.log(`${process.pid} started on port ${port}`));
}

// https://github.com/WebKakao/talk/projects/1
