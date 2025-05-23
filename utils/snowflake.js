/**
 * 雪花ID生成器
 * 生成的ID格式：
 * 0 - 0000000000 0000000000 0000000000 0000000000 0 - 00000 - 00000 - 000000000000
 * 1位符号位（始终为0）
 * 41位时间戳（毫秒级，可以使用69年）
 * 5位数据中心ID
 * 5位工作机器ID
 * 12位序列号（每毫秒可以生成4096个ID）
 */
class Snowflake {
  /**
   * 构造函数
   * @param {number} workerId 工作机器ID (0-31)
   * @param {number} dataCenterId 数据中心ID (0-31)
   */
  constructor(workerId = 1, dataCenterId = 1) {
    // 2023-01-01 00:00:00 的时间戳（毫秒）
    this.twepoch = 1672531200000;
    
    // 各部分的位数
    this.workerIdBits = 5;
    this.dataCenterIdBits = 5;
    this.sequenceBits = 12;
    
    // 最大值
    this.maxWorkerId = -1 ^ (-1 << this.workerIdBits);
    this.maxDataCenterId = -1 ^ (-1 << this.dataCenterIdBits);
    this.sequenceMask = -1 ^ (-1 << this.sequenceBits);
    
    // 位移
    this.workerIdShift = this.sequenceBits;
    this.dataCenterIdShift = this.sequenceBits + this.workerIdBits;
    this.timestampShift = this.sequenceBits + this.workerIdBits + this.dataCenterIdBits;
    
    // 参数校验
    if (workerId > this.maxWorkerId || workerId < 0) {
      throw new Error(`Worker ID must be between 0 and ${this.maxWorkerId}`);
    }
    if (dataCenterId > this.maxDataCenterId || dataCenterId < 0) {
      throw new Error(`Data center ID must be between 0 and ${this.maxDataCenterId}`);
    }
    
    this.workerId = workerId;
    this.dataCenterId = dataCenterId;
    this.sequence = 0;
    this.lastTimestamp = -1;
  }

  /**
   * 生成下一个ID
   * @returns {string} 生成的ID字符串
   */
  nextId() {
    let timestamp = BigInt(Date.now());
    
    // 如果当前时间小于上次ID生成的时间戳，说明系统时间回退过
    if (timestamp < BigInt(this.lastTimestamp)) {
      throw new Error(`Clock moved backwards. Refusing to generate id for ${this.lastTimestamp - timestamp}ms`);
    }
    
    // 如果是同一毫秒内生成的，则进行序列号自增
    if (BigInt(this.lastTimestamp) === timestamp) {
      this.sequence = (this.sequence + 1) & this.sequenceMask;
      // 序列号溢出，等待下一毫秒
      if (this.sequence === 0) {
        timestamp = BigInt(this.tilNextMillis(this.lastTimestamp));
      }
    } else {
      // 时间戳改变，序列号重置
      this.sequence = 0;
    }
    
    this.lastTimestamp = Number(timestamp);
    
    // 生成ID（使用BigInt确保不会出现精度丢失）
    const result = (BigInt(timestamp - BigInt(this.twepoch)) << BigInt(this.timestampShift)) |
                  (BigInt(this.dataCenterId) << BigInt(this.dataCenterIdShift)) |
                  (BigInt(this.workerId) << BigInt(this.workerIdShift)) |
                  BigInt(this.sequence);
    
    // 返回字符串形式
    return result.toString();
  }

  /**
   * 等待到下一毫秒
   * @private
   */
  tilNextMillis(lastTimestamp) {
    let timestamp = Date.now();
    while (timestamp <= lastTimestamp) {
      timestamp = Date.now();
    }
    return timestamp;
  }
}

// 导出单例实例
// 注意：在生产环境中，workerId 和 dataCenterId 应该从环境变量或配置中获取
const workerId = process.env.WORKER_ID ? parseInt(process.env.WORKER_ID, 10) : 1;
const dataCenterId = process.env.DATA_CENTER_ID ? parseInt(process.env.DATA_CENTER_ID, 10) : 1;

// 创建单例
const snowflake = new Snowflake(workerId, dataCenterId);

// 导出单例和类
module.exports = {
  Snowflake,
  instance: snowflake,
  generate: () => snowflake.nextId().toString()
};
