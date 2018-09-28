const httpx = require('httpx');
const liburl = require('url');
const JSONbig = require('json-bigint');
const { wrapper, postJSON, replaceJSONCtlChars } = require('./util');

class AccessToken {
  constructor(accessToken, expireTime) {
    this.accessToken = accessToken;
    expireTime = Date.now() + (expireTime - 10) * 1000;
    this.expireTime = expireTime;
  }

  /*!
   * 检查AccessToken是否有效，检查规则为当前时间和过期时间进行对比
   * Examples:
   * ```
   * token.isValid();
   * ```
   */
  isValid() {
    return !!this.accessToken && Date.now() < this.expireTime;
  }
}
/**
 * 根据suite_id、suite_secret和suite_ticket创建API的构造函数。
 *
 * 如需跨进程跨机器进行操作Wechat API（依赖access token），access token需要进行全局维护
 * 使用策略如下：
 *
 * 1. 调用用户传入的获取token的异步方法，获得token之后使用
 * 2. 使用appid/appsecret获取token。并调用用户传入的保存token方法保存
 *
 * Examples:
 * ```
 * var API = require('wechat-corp-service');
 * var api = new API('suite_id', 'suite_secret', 'suite_ticket');
 * ```
 * 以上即可满足单进程使用。
 * 当多进程时，token需要全局维护，以下为保存token的接口。
 * ```
 * var api = new API('suite_id', 'suite_secret', 'suite_ticket', function (callback) {
 *   // 传入一个获取全局token的方法
 *   fs.readFile('suite_access_token.txt', 'utf8', function (err, txt) {
 *     if (err) {return callback(err);}
 *     callback(null, JSON.parse(txt));
 *   });
 * }, function (token, callback) {
 *   // 请将token存储到全局，跨进程、跨机器级别的全局，比如写到数据库、redis等
 *   // 这样才能在cluster模式及多机情况下使用，以下为写入到文件的示例
 *   fs.writeFile('suite_access_token.txt', JSON.stringify(token), callback);
 * });
 * ```
 * @param {String} suiteId 在PaaS平台上申请得到的suiteId
 * @param {String} suiteSecret 在PaaS平台上申请得到的suiteSecret
 * @param {String} suiteTicket 微信服务器每10分钟向回调接口推送的suite_ticket消息
 * @param {Function} getToken 可选的。获取全局token对象的方法，多进程模式部署时需在意
 * @param {Function} saveToken 可选的。保存全局token对象的方法，多进程模式部署时需在意
 */
class API {
  constructor(suiteId, suiteSecret, suiteTicket, getToken, saveToken) {
    this.AccessToken = AccessToken;
    this.suiteId = suiteId;
    this.suiteSecret = suiteSecret;
    this.suiteTicket = suiteTicket;
    this.corpAccessToken = {};
    this.store = null;
    this.getToken = getToken || async function getToken() {
      return this.store;
    };
    this.saveToken = saveToken || async function (token) {
      this.store = token;
      if (process.env.NODE_ENV === 'production') {
        console.warn('Don\'t save token in memory, when cluster or multi-computer!');
      }
    };
    this.prefix = 'https://qyapi.weixin.qq.com/cgi-bin/';
    this.defaults = {};
  }

  /**
   * 用于设置urllib的默认options
   *
   * Examples:
   * ```
   * api.setOpts({timeout: 15000});
   * ```
   * @param {Object} opts 默认选项
   */
  setOpts (opts) {
    this.defaults = opts;
  }

  /**
   * 设置urllib的hook
   */
  async request (url, opts, retry) {
    if (typeof retry === 'undefined') {
      retry = 3;
    }

    var options = {};
    Object.assign(options, this.defaults);
    opts || (opts = {});
    var keys = Object.keys(opts);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      if (key !== 'headers') {
        options[key] = opts[key];
      } else {
        if (opts.headers) {
          options.headers = options.headers || {};
          Object.assign(options.headers, opts.headers);
        }
      }
    }
    var res = await httpx.request(url, options);
    if (res.statusCode < 200 || res.statusCode > 204) {
      var err = new Error(`url: ${url}, status code: ${res.statusCode}`);
      err.name = 'WeChatAPIError';
      throw err;
    }

    var buffer = await httpx.read(res);
    var contentType = res.headers['content-type'] || '';
    if (contentType.indexOf('application/json') !== -1) {
      var data;
      var origin = buffer.toString();
      try {
        data = JSONbig.parse(replaceJSONCtlChars(origin));
      } catch (ex) {
        let err = new Error('JSON.parse error. buffer is ' + origin);
        err.name = 'WeChatAPIError';
        throw err;
      }

      if (data && data.errcode) {
        let err = new Error(data.errmsg);
        err.name = 'WeChatAPIError';
        err.code = data.errcode;

        if ((err.code === 40001 || err.code === 42001) && retry > 0 && !this.tokenFromCustom) {
          // 销毁已过期的token
          await this.saveToken(null);
          let token = await this.getAccessToken();
          let urlobj = liburl.parse(url, true);

          if (urlobj.query && urlobj.query.access_token) {
            urlobj.query.access_token = token.accessToken;
            delete urlobj.search;
          }
          return this.request(liburl.format(urlobj), opts, retry - 1);
        }
        throw err;
      }
      return data;
    }
    return buffer;
  }

  /*!
   * 根据创建API时传入的suiteId,suiteSecret和suiteTicket获取suite access token
   * 进行后续所有API调用时，需要先获取access token
   * 详细请看：<http://mp.weixin.qq.com/wiki/index.php?title=获取access_token>
   *
   * 应用开发者无需直接调用本API。
   *
   * Examples:
   * ```
   * api.getSuiteToken(callback);
   * ```
   * Callback:
   *
   * - `err`, 获取access token出现异常时的异常对象
   * - `result`, 成功时得到的响应结果
   *
   * Result:
   * ```
   * {"suite_access_token": "ACCESS_TOKEN",
   *  "expires_in": 7200 }
   * ```
   * @param {Function} callback 回调函数
   */
  async getSuiteAccessToken () {
    // https://qyapi.weixin.qq.com/cgi-bin/department/create?access_token=ACCESS_TOKEN
    var url = this.prefix + 'service/get_suite_token';
    var params = {
      suite_id: this.suiteId,
      suite_secret: this.suiteSecret,
      suite_ticket: this.suiteTicket
    };
    var data = await this.request(url, postJSON(params));

    const token = new AccessToken(data.suite_access_token, data.expires_in);
    await this.saveToken(token);

    return token;
  }

  /*!
   * 需要access token的接口调用如果采用preRequest进行封装后，就可以直接调用。
   * 无需依赖 getAccessToken 为前置调用。
   * 应用开发者无需直接调用此API。
   * Examples:
   * ```
   * await api.ensureSuiteAccessToken();
   * ```
   */
  async ensureSuiteAccessToken () {
    // 调用用户传入的获取token的异步方法，获得token之后使用（并缓存它）。
    var token = await this.getToken();
    if (token) {
      if (token.isValid) {
        if (token.isValid()) return token;
      } else {
        const accessToken = new AccessToken(token.accessToken, token.expireTime);
        if (accessToken.isValid()) return accessToken;
      }
    }
    token = await this.getSuiteAccessToken();
    return token;
  }

  /*!
   * generateAuthUrl
   * 拼装出第三方授权用的URL
   * Examples:
   * ```
   * api.generateAuthUrl((preAuthCode, redirectUri, state);
   * ```
   *
   */

  generateAuthUrl (preAuthCode, redirectUri, state) {
    return 'https://qy.weixin.qq.com/cgi-bin/loginpage?suite_id=' + this.suiteId +
      "&pre_auth_code=" + preAuthCode + "&redirect_uri=" +
      redirectUri + "&state=" + state;
  }

  setSuiteTicket (newTicket) {
    this.suiteTicket = newTicket;
  }
}

/**
 * 用于支持对象合并。将对象合并到API.prototype上，使得能够支持扩展
 * Examples:
 * ```
 * // 媒体管理（上传、下载）
 * API.mixin(require('./lib/api_media'));
 * ```
 * @param {Object} obj 要合并的对象
 */
API.mixin = function (obj) {
  for (var key in obj) {
    if (API.prototype.hasOwnProperty(key)) {
      throw new Error('Don\'t allow override existed prototype method. method: '+ key);
    }
    API.prototype[key] = obj[key];
  }
};

//API.AccessToken = AccessToken;

module.exports = API;
