Page({
  data: {
    token: "",
    user: null,
    displayName: "",
    currentSemester: "",
    loading: false,
    refreshing: false,
    mirrorLoading: false,
    tab: "home",
    loginForm: {
      studentId: "",
      password: ""
    },
    feedbackForm: {
      title: "",
      content: "",
      isAnonymous: false
    },
    categories: [],
    categoryIndex: 0,
    subCategoryIndex: 0,
    feedbacks: [],
    siteHome: null,
    homeNotices: [],
    homeLeadNotice: null,
    selectedNotice: null,
    departmentDetail: null,
    departmentGroups: [
      {
        marker: "01",
        title: "团委",
        items: [
          { key: "organization", label: "组织部" },
          { key: "publicity", label: "宣传部" },
          { key: "practice", label: "实践部" },
          { key: "volunteer", label: "志愿者工作部" }
        ]
      },
      {
        marker: "02",
        title: "学生会",
        items: [
          { key: "general", label: "综合办公室" },
          { key: "rights", label: "学生权益部" },
          { key: "culture", label: "文体艺术部" },
          { key: "academic", label: "学术科技部" },
          { key: "media", label: "新媒体工作部" }
        ]
      }
    ],
    statusText: {
      pending: "待处理",
      processing: "处理中",
      resolved: "已解决",
      rejected: "已驳回"
    },
    priorityText: {
      low: "低",
      normal: "普通",
      high: "高",
      urgent: "紧急"
    },
    portals: [
      {
        key: "rights",
        badge: "SIEVOX",
        title: "学生权益反馈系统",
        desc: "反馈、诉求跟进与处理进度查询",
        accent: "blue"
      },
      {
        key: "bridge",
        badge: "SIEBridge",
        title: "课程资源共享平台",
        desc: "课程资料、上传审核与共享入口",
        accent: "teal"
      }
    ],
    bridgeSteps: [
      "上传课程资料、讲义与整理后的文件",
      "资料进入审核流，保留提交记录",
      "通过后同步到课程资源页，便于查阅"
    ]
  },

  onLoad() {
    const app = getApp();
    const token = wx.getStorageSync("sievox_token") || "";
    const user = wx.getStorageSync("sievox_user") || null;
    this.setData({
      categories: app.globalData.categories || [],
      token,
      user,
      displayName: this.getDisplayName(user)
    });
    this.loadMirrorHome();
    if (token) this.loadFeedbacks();
  },

  request(path, options = {}) {
    const app = getApp();
    const header = Object.assign(
      { "Content-Type": "application/json" },
      options.header || {}
    );
    if (this.data.token) header.Authorization = `Bearer ${this.data.token}`;
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${app.globalData.apiBase}${path}`,
        method: options.method || "GET",
        data: options.data || {},
        header,
        success: (res) => {
          if (res.statusCode >= 200 && res.statusCode < 300 && res.data && res.data.success !== false) {
            resolve(res.data);
          } else {
            reject(new Error((res.data && res.data.message) || `请求失败：${res.statusCode}`));
          }
        },
        fail: () => reject(new Error("网络请求失败，请检查合法域名和网络连接"))
      });
    });
  },

  onLoginInput(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({ [`loginForm.${field}`]: event.detail.value });
  },

  async login() {
    const { studentId, password } = this.data.loginForm;
    if (!studentId || !password) {
      wx.showToast({ title: "请输入学号和密码", icon: "none" });
      return;
    }
    this.setData({ loading: true });
    try {
      const data = await this.request("/auth/login", {
        method: "POST",
        data: { studentId, password, remember: true }
      });
      wx.setStorageSync("sievox_token", data.token);
      wx.setStorageSync("sievox_user", data.user);
      this.setData({
        token: data.token,
        user: data.user,
        displayName: this.getDisplayName(data.user),
        loginForm: { studentId: "", password: "" },
        tab: "home"
      });
      wx.showToast({ title: "登录成功", icon: "success" });
      await Promise.all([this.loadMirrorHome(), this.loadFeedbacks()]);
    } catch (error) {
      wx.showToast({ title: error.message, icon: "none" });
    } finally {
      this.setData({ loading: false });
    }
  },

  logout() {
    wx.removeStorageSync("sievox_token");
    wx.removeStorageSync("sievox_user");
    this.setData({
      token: "",
      user: null,
      displayName: "",
      feedbacks: [],
      homeNotices: [],
      homeLeadNotice: null,
      departmentDetail: null,
      tab: "home"
    });
    this.loadMirrorHome();
  },

  switchTab(event) {
    const tab = event.currentTarget.dataset.tab;
    this.setData({ tab });
    if (tab === "mine") this.loadFeedbacks();
    if (tab === "home") this.loadMirrorHome();
    if (tab === "departments" && (!this.data.departmentDetail || !this.data.departmentDetail.notices) && this.data.departmentGroups.length) {
      const firstGroup = this.data.departmentGroups.find(group => group.items && group.items.length);
      if (firstGroup?.items?.length) {
        const firstDept = firstGroup.items[0];
        this.loadDepartmentDetail(firstDept.organization, firstDept.department);
      }
    }
  },

  getDisplayName(user) {
    return (user && (user.name || user.studentId)) || "";
  },

  getLocalizedText(value, fallback = "") {
    if (!value) return fallback;
    if (typeof value === "string") return value || fallback;
    if (typeof value === "object") {
      return value.zh || value.en || fallback;
    }
    return fallback;
  },

  resolveRemoteUrl(value) {
    if (!value) return "";
    if (/^(https?:)?\/\//.test(value) || value.startsWith("data:") || value.startsWith("wxfile://") || value.startsWith("cloud://")) {
      return value;
    }
    if (value.startsWith("/api/")) {
      return `${getApp().globalData.apiBase.replace(/\/api$/, "")}${value}`;
    }
    return value;
  },

  openPortal(event) {
    const key = event.currentTarget.dataset.key;
    if (key === "rights") {
      this.setData({ tab: "submit" });
      return;
    }
    if (key === "bridge") {
      this.setData({ tab: "bridge" });
    }
  },

  openNotice(event) {
    const notice = this.data.homeNotices[Number(event.currentTarget.dataset.index)];
    if (!notice) return;
    this.setData({ tab: "notice", selectedNotice: {
      ...notice,
      displayBody: this.getLocalizedText(notice.body, this.getLocalizedText(notice.content, notice.displaySummary || "暂无正文"))
    } });
    wx.pageScrollTo({ scrollTop: 0, duration: 0 });
  },

  copyNoticeSource() {
    const sourceUrl = this.data.selectedNotice && this.data.selectedNotice.sourceUrl;
    if (sourceUrl) wx.setClipboardData({ data: sourceUrl });
  },

  openDepartment(event) {
    const organization = event.currentTarget.dataset.organization;
    const department = event.currentTarget.dataset.department;
    if (!organization || !department) return;
    this.setData({ tab: "departments" });
    this.loadDepartmentDetail(organization, department);
  },

  createDepartmentGroups(departments = []) {
    const groupMap = [
      { marker: "01", title: "团委", organization: "youth_league", items: [] },
      { marker: "02", title: "学生会", organization: "student_union", items: [] }
    ];
    departments.forEach((dept, index) => {
      const group = groupMap.find(item => item.organization === dept.organization);
      if (!group) return;
      group.items.push({
        ...dept,
        marker: String(index + 1).padStart(2, "0")
      });
    });
    const mapped = groupMap.map(({ organization, ...group }) => group);
    if (mapped.some(group => group.items.length)) {
      return mapped;
    }
    return [
      {
        marker: "01",
        title: "团委",
        items: [
          { organization: "youth_league", department: "organization", label: "组织部" },
          { organization: "youth_league", department: "publicity", label: "宣传部" },
          { organization: "youth_league", department: "practice", label: "实践部" },
          { organization: "youth_league", department: "volunteer_service", label: "志愿者工作部" }
        ]
      },
      {
        marker: "02",
        title: "学生会",
        items: [
          { organization: "student_union", department: "general_office", label: "综合办公室" },
          { organization: "student_union", department: "student_rights", label: "学生权益部" },
          { organization: "student_union", department: "culture_sports_arts", label: "文体艺术部" },
          { organization: "student_union", department: "academic_technology", label: "学术科技部" },
          { organization: "student_union", department: "new_media", label: "新媒体工作部" }
        ]
      }
    ];
  },

  onCategoryChange(event) {
    this.setData({
      categoryIndex: Number(event.detail.value || 0),
      subCategoryIndex: 0
    });
  },

  onSubCategoryChange(event) {
    this.setData({ subCategoryIndex: Number(event.detail.value || 0) });
  },

  onFeedbackInput(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({ [`feedbackForm.${field}`]: event.detail.value });
  },

  onAnonymousChange(event) {
    this.setData({ "feedbackForm.isAnonymous": event.detail.value.length > 0 });
  },

  async submitFeedback() {
    if (!this.data.token) {
      wx.showToast({ title: "请先登录", icon: "none" });
      return;
    }
    const category = this.data.categories[this.data.categoryIndex];
    const subCategory = category && category.sub[this.data.subCategoryIndex];
    const { title, content, isAnonymous } = this.data.feedbackForm;
    if (!category || !subCategory || !title.trim() || !content.trim()) {
      wx.showToast({ title: "请完整填写反馈内容", icon: "none" });
      return;
    }
    this.setData({ loading: true });
    try {
      await this.request("/feedback", {
        method: "POST",
        data: {
          category: category.key,
          subCategory,
          title: title.trim(),
          content: content.trim(),
          priority: "normal",
          isAnonymous
        }
      });
      this.setData({
        feedbackForm: { title: "", content: "", isAnonymous: false },
        tab: "mine"
      });
      wx.showToast({ title: "提交成功", icon: "success" });
      await this.loadFeedbacks();
    } catch (error) {
      wx.showToast({ title: error.message, icon: "none" });
    } finally {
      this.setData({ loading: false });
    }
  },

  async loadMirrorHome() {
    this.setData({ mirrorLoading: true });
    try {
      const data = await this.request("/mobile/home");
      const homeNotices = (data.notices || []).map((notice) => ({
        ...notice,
        coverImageUrl: this.resolveRemoteUrl(notice.coverImageUrl),
        displayTitle: this.getLocalizedText(notice.title),
        displaySummary: this.getLocalizedText(notice.summary, this.getLocalizedText(notice.body)),
        displayDepartment: notice.departmentLabel || notice.department || "",
        displayTime: this.formatTime(notice.publishedAt || notice.createdAt)
      }));
      const departmentGroups = this.createDepartmentGroups(data.departments || []);
      const firstDepartment = departmentGroups.find(group => group.items && group.items.length)?.items?.[0] || null;
      this.setData({
        siteHome: data.hero ? {
          ...data.hero,
          coverImageUrl: this.resolveRemoteUrl(data.hero.coverImageUrl)
        } : null,
        currentSemester: data.currentSemester || "",
        homeNotices,
        homeLeadNotice: homeNotices[0] || null,
        departmentGroups,
        departmentDetail: firstDepartment ? {
          ...firstDepartment,
          coverImageUrl: this.resolveRemoteUrl(firstDepartment.coverImageUrl)
        } : null
      });
    } catch (error) {
      this.setData({
        siteHome: null,
        currentSemester: "",
        homeNotices: [],
        homeLeadNotice: null,
        departmentDetail: null
      });
    }
    this.setData({ mirrorLoading: false });
  },

  async loadDepartmentDetail(organization, department) {
    if (!organization || !department) return;
    this.setData({ mirrorLoading: true });
    try {
      const data = await this.request(`/mobile/departments/${organization}/${department}`);
      const departmentDetail = {
        ...data.department,
        coverImageUrl: this.resolveRemoteUrl(data.department?.coverImageUrl),
        introduction: data.introduction,
        notices: (data.notices || []).map((notice) => ({
          ...notice,
          coverImageUrl: this.resolveRemoteUrl(notice.coverImageUrl),
          displayTitle: this.getLocalizedText(notice.title),
          displaySummary: this.getLocalizedText(notice.summary, this.getLocalizedText(notice.body)),
          displayTime: this.formatTime(notice.publishedAt || notice.createdAt)
        }))
      };
      this.setData({ departmentDetail });
    } catch (error) {
      wx.showToast({ title: error.message, icon: "none" });
    } finally {
      this.setData({ mirrorLoading: false });
    }
  },

  async loadFeedbacks() {
    if (!this.data.token) return;
    this.setData({ refreshing: true });
    try {
      const data = await this.request("/feedback/my?limit=20");
      this.setData({ feedbacks: data.feedbacks || [] });
    } catch (error) {
      wx.showToast({ title: error.message, icon: "none" });
    } finally {
      this.setData({ refreshing: false });
      wx.stopPullDownRefresh();
    }
  },

  formatTime(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  },

  onPullDownRefresh() {
    if (this.data.tab === "mine") {
      this.loadFeedbacks();
      return;
    }
    if (this.data.tab === "home") {
      this.loadMirrorHome();
      wx.stopPullDownRefresh();
      return;
    }
    if (this.data.tab === "departments" && this.data.departmentDetail) {
      this.loadDepartmentDetail(this.data.departmentDetail.organization, this.data.departmentDetail.department);
      wx.stopPullDownRefresh();
      return;
    }
    wx.stopPullDownRefresh();
  }
});
