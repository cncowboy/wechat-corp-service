'use strict';
var querystring = require('querystring');

exports.getDepartments = async function (corpId, permanentCode) {
  // https://qyapi.weixin.qq.com/cgi-bin/department/list?access_token=ACCESS_TOKEN
  const { accessToken } = await this.ensureCorpAccessToken(corpId, permanentCode);
  var url = this.prefix + 'department/list?access_token=' + accessToken;
  var opts = {dataType: 'json'};
  return await this.request(url, opts);
};

/**
 * 获取部门成员
 *
 * Examples:
 * ```
 * var result = yield api.getDepartmentUsers(departmentId, fetchChild, status);
 * ```
 *
 * Result:
 * ```
 * {
 *   "errcode": 0,
 *   "errmsg": "ok",
 *   "userlist": [
 *     {
 *       "userid": "zhangsan",
 *       "name": "李四"
 *     }
 *   ]
 * }
 * ```
 * @param {Number} departmentId 部门ID
 * @param {Number} fetchChild 值：1/0，是否递归获取子部门下面的成员
 * @param {Number} status 0获取全部员工，1获取已关注成员列表，2获取禁用成员列表，4获取未关注成员列表。status可叠加
 */
exports.getDepartmentUsers = async function (corpId, permanentCode, departmentId, fetchChild, status) {
  const { accessToken } = await this.ensureCorpAccessToken(corpId, permanentCode);
  var url = this.prefix + 'user/simplelist?access_token=' + accessToken;
  url += '&' + querystring.stringify({
    department_id: departmentId,
    fetch_child: fetchChild,
    status: status
  });
  var opts = {
    dataType: 'json',
  };
  return await this.request(url, opts);
};

/**
 * 获取部门成员(详情)
 *
 * Examples:
 * ```
 * var result = yield api.getDepartmentUsersDetail(departmentId, fetchChild, status);
 * ```
 *
 * Result:
 * ```
 * {
 *  "errcode": 0,
 *  "errmsg": "ok",
 *  "userlist": [
 *    {
 *      "userid": "zhangsan",
 *      "name": "李四",
 *      "department": [1, 2],
 *      "position": "后台工程师",
 *      "mobile": "15913215421",
 *      "email": "zhangsan@gzdev.com",
 *      "weixinid": "lisifordev",
 *      "avatar": "http://wx.qlogo.cn/mmopen/ajNVdqHZLLA3WJ6DSZUfiakYe37PKnQhBIeOQBO4czqrnZDS79FH5Wm5m4X69TBicnHFlhiafvDwklOpZeXYQQ2icg/0",
 *      "status": 1,
 *      "extattr": {"attrs":[{"name":"爱好","value":"旅游"},{"name":"卡号","value":"1234567234"}]}
 *    }
 *  ]
 * }
 * ```
 * @param {Number} departmentId 部门ID
 * @param {Number} fetchChild 值：1/0，是否递归获取子部门下面的成员
 * @param {Number} status 0获取全部员工，1获取已关注成员列表，2获取禁用成员列表，4获取未关注成员列表。status可叠加
 */
exports.getDepartmentUsersDetail = async function (corpId, permanentCode, departmentId, fetchChild, status) {
  var token = await this.ensureCorpAccessToken(corpId, permanentCode);
  var url = this.prefix + 'user/list?access_token=' + token.accessToken;
  url += '&' + querystring.stringify({
    department_id: departmentId,
    fetch_child: fetchChild,
    status: status
  });
  var opts = {
    dataType: 'json',
  };
  return await this.request(url, opts);
};

/**
 * 发送消息分别有图片（image）、语音（voice）、视频（video）和缩略图（thumb）
 * 详细请看：http://qydev.weixin.qq.com/wiki/index.php?title=发送接口说明
 * Examples:
 * ```
 * var result = yield api.send(agentid, to, message);
 * ```
 * To:
 * ```
 * {
 *  "touser": "UserID1|UserID2|UserID3",
 *  "toparty": " PartyID1 | PartyID2 ",
 *  "totag": " TagID1 | TagID2 "
 * }
 * ```
 * Message:
 * 文本消息：
 * ```
 * {
 *  "msgtype": "text",
 *  "text": {
 *    "content": "Holiday Request For Pony(http://xxxxx)"
 *  },
 *  "safe":"0"
 * }
 * ```
 * 图片消息：
 * ```
 * {
 *  "msgtype": "image",
 *  "image": {
 *    "media_id": "MEDIA_ID"
 *  },
 *  "safe":"0"
 * }
 * ```
 * 图片消息：
 * ```
 * {
 *  "msgtype": "image",
 *  "image": {
 *    "media_id": "MEDIA_ID"
 *  },
 *  "safe":"0"
 * }
 * ```
 * 语音消息：
 * ```
 * {
 *  "msgtype": "voice",
 *  "voice": {
 *    "media_id": "MEDIA_ID"
 *  },
 *  "safe":"0"
 * }
 * ```
 * 视频消息：
 * ```
 * {
 *  "msgtype": "video",
 *  "video": {
 *    "media_id": "MEDIA_ID"
 *    "title": "Title",
 *    "description": "Description"
 *  },
 *  "safe":"0"
 * }
 * ```
 * 文件消息：
 * ```
 * {
 *  "msgtype": "file",
 *  "file": {
 *    "media_id": "MEDIA_ID"
 *  },
 *  "safe":"0"
 * }
 * ```
 * 图文消息：
 * ```
 * {
 *  "msgtype": "news",
 *  "news": {
 *    "articles":[
 *      {
 *        "title": "Title",
 *        "description": "Description",
 *        "url": "URL",
 *        "picurl": "PIC_URL",
 *      },
 *      {
 *        "title": "Title",
 *        "description": "Description",
 *        "url": "URL",
 *        "picurl": "PIC_URL",
 *      }
 *    ]
 *  },
 *  "safe":"0"
 * }
 * ```
 * MP消息：
 * ```
 * {
 *  "msgtype": "mpnews",
 *  "mpnews": {
 *    "articles":[
 *      {
 *        "thumb_media_id": "id",
 *        "author": "Author",
 *        "content_source_url": "URL",
 *        "content": "Content"
 *        "digest": "Digest description",
 *        "show_cover_pic": "0"
 *      },
 *      {
 *        "thumb_media_id": "id",
 *        "author": "Author",
 *        "content_source_url": "URL",
 *        "content": "Content"
 *        "digest": "Digest description",
 *        "show_cover_pic": "0"
 *      }
 *    ],
 *    "media_id": "id"
 *  },
 *  "safe":"0"
 * }
 * ```
 *
 * Result:
 * ```
 * {
 *  "errcode": 0,
 *  "errmsg": "ok",
 *  "invaliduser": "UserID1",
 *  "invalidparty":"PartyID1",
 *  "invalidtag":"TagID1"
 * }
 * ```
 *
 * @param {String} agentid APP
 * @param {Object} to 接受消息的用户
 * @param {Object} message 消息对象
 */
exports.send = async function (corpId, permanentCode, agentid, to, message) {
  var token = await this.ensureCorpAccessToken(corpId, permanentCode);
  var url = this.prefix + 'message/send?access_token=' + token.accessToken;
  var data = {
    agentid: agentid
  };
  extend(data, to);
  extend(data, message);

  return await this.request(url, postJSON(data));
};
